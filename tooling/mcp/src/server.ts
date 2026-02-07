/**
 * MCP Server — Bunner Knowledge Graph System
 *
 * §6 MCP Interface + §8.1 Startup sequence:
 *   load config → create DB → compute workspace → init modules → register MCP tools → start background sync
 *
 * 19 MCP tools (§6.1–§6.5):
 *   Query(5): search, describe, relations, facts, evidence
 *   Analysis(6): impact_analysis, dependency_graph, trace_chain, coverage_map, inconsistency_report, find_orphans
 *   Temporal(2): recent_changes, changelog
 *   Operations(4): kb_health, verify_integrity, sync, purge_tombstones
 *   Bulk(2): bulk_describe, bulk_facts
 *
 * §6.6 Autonomous processes (background, not MCP tools):
 *   Startup scan, fs.watch, Read-through validation, Background worker
 *
 * @see MCP_PLAN §6, §8.1, §9
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

import { createDb, type Db } from './db';
import { readEnv } from './env';
import { computeWorkspaceId } from './workspace';
import { loadConfig, type KBConfig } from './config';
import { SyncQueue } from './sync-queue';
import { SyncWorker } from './sync-worker';
import { HashCache } from './hash-cache';
import { FileWatcher } from './watcher';
import { ReadThroughValidator } from './read-through';
import { createDefaultRegistry } from './parsers';
import { QueryTools } from './tools/query';
import { AnalysisTools } from './tools/analysis';
import { TemporalTools } from './tools/temporal';
import { OperationsTools } from './tools/operations';
import { kbLog } from './logger';

// ── JSON Response Helper ────────────────────────────────────

function jsonResponse(data: unknown) {
	return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

function errorResponse(tool: string, detail: string) {
	const message = `[kb] Tool execution failed: ${tool}\nDetail: ${detail}`;
	return { content: [{ type: 'text' as const, text: message }], isError: true };
}

// ── Tool Definitions ─────────────────────────────────────────

const TOOL_DEFINITIONS = [
	// ── Query ───────────────────────────────────────────────
	{
		name: 'search',
		description: '코드베이스의 엔티티(모듈, 파일, 클래스 등)·관계·팩트를 키워드로 검색한다. 각 결과에 stale 플래그(파일 변경 후 아직 재동기화되지 않음)가 포함된다. 작업 시작 시 관련 코드를 파악하거나, 특정 심볼·파일을 찾을 때 사용한다.',
		inputSchema: {
			type: 'object',
			properties: {
				query: { type: 'string', minLength: 1, description: '검색 키워드. 모듈명, 함수명, 파일 경로 등 자유 텍스트.' },
				limit: { type: 'integer', minimum: 1, maximum: 50, default: 10, description: '반환할 최대 결과 수.' },
				filters: {
					type: 'object',
					description: '결과를 특정 타입으로 좁힌다.',
					properties: {
						entityType: { type: 'string', description: '엔티티 타입 필터. 예: module, file, class, function, spec' },
						factType: { type: 'string', description: '팩트 타입 필터. 예: export, dependency, config' },
					},
				},
				mode: { type: 'string', enum: ['lexical', 'vector', 'hybrid'], default: 'lexical', description: '검색 모드. lexical=키워드 매칭, vector=의미 유사도, hybrid=둘 다.' },
			},
			required: ['query'],
			additionalProperties: false,
		},
	},
	{
		name: 'describe',
		description: '특정 엔티티의 전체 프로필을 조회한다: 메타데이터, 소스 파일 위치, 연결된 팩트(타입 정보·설정값·export 등) 요약. 엔티티의 현재 상태를 정확히 파악할 때 사용한다.',
		inputSchema: {
			type: 'object',
			properties: {
				entityKey: { type: 'string', minLength: 1, description: '조회할 엔티티 키. 형식: "type::name" (예: "module::@bunner/core", "file::src/app.ts")' },
			},
			required: ['entityKey'],
			additionalProperties: false,
		},
	},
	{
		name: 'relations',
		description: '엔티티의 관계(imports, exports, implements, depends_on 등)를 탐색한다. depth로 N-hop 확장이 가능하여, 직접 관계뿐 아니라 간접 연결까지 파악할 수 있다. 모듈 간 의존 구조를 이해할 때 사용한다.',
		inputSchema: {
			type: 'object',
			properties: {
				entityKey: { type: 'string', minLength: 1, description: '탐색 기준 엔티티 키. 형식: "type::name"' },
				direction: { type: 'string', enum: ['outgoing', 'incoming', 'both'], description: 'outgoing=이 엔티티가 참조하는 것, incoming=이 엔티티를 참조하는 것, both=양방향' },
				relationType: { type: 'string', description: '특정 관계 타입만 필터링. 예: imports, exports, implements, tests' },
				depth: { type: 'integer', minimum: 1, maximum: 10, default: 1, description: '탐색 깊이. 1=직접 관계만, 2+=간접 관계까지 확장' },
				limit: { type: 'integer', minimum: 1, maximum: 200, default: 50, description: '반환할 최대 관계 수' },
			},
			required: ['entityKey'],
			additionalProperties: false,
		},
	},
	{
		name: 'facts',
		description: '엔티티에 연결된 팩트 목록을 조회한다. 팩트란 엔티티의 구체적 속성 정보(export 목록, 설정값, 타입 시그니처, 메타데이터 등)이다. 엔티티의 세부 속성을 확인할 때 사용한다.',
		inputSchema: {
			type: 'object',
			properties: {
				entityKey: { type: 'string', minLength: 1, description: '조회할 엔티티 키. 형식: "type::name"' },
				factType: { type: 'string', description: '특정 팩트 타입만 필터링. 예: export, dependency, config, type_signature' },
				limit: { type: 'integer', minimum: 1, maximum: 200, default: 50, description: '반환할 최대 팩트 수' },
			},
			required: ['entityKey'],
			additionalProperties: false,
		},
	},
	{
		name: 'evidence',
		description: '특정 관계(relation)의 근거가 되는 팩트 목록을 조회한다. "왜 이 두 엔티티가 연결되어 있는가?"를 추적할 때 사용한다. relationId는 relations 도구의 결과에서 얻는다.',
		inputSchema: {
			type: 'object',
			properties: {
				relationId: { type: 'integer', minimum: 1, description: '조회할 관계 ID. relations 도구 결과의 id 필드 값을 사용한다.' },
			},
			required: ['relationId'],
			additionalProperties: false,
		},
	},

	// ── Analysis ────────────────────────────────────────────
	{
		name: 'impact_analysis',
		description: '엔티티 변경 시 영향받는 범위를 역방향 의존성으로 추적한다. "이 파일/모듈을 수정하면 어디가 깨질 수 있는가?"에 답한다. 코드를 수정하기 전에 반드시 호출하여 영향 범위를 파악해야 한다.',
		inputSchema: {
			type: 'object',
			properties: {
				entityKey: { type: 'string', minLength: 1, description: '변경 대상 엔티티 키. 형식: "type::name"' },
				depth: { type: 'integer', minimum: 1, maximum: 10, default: 3, description: '영향 추적 깊이. 3이면 3단계 간접 의존까지 포함' },
			},
			required: ['entityKey'],
			additionalProperties: false,
		},
	},
	{
		name: 'dependency_graph',
		description: '엔티티의 의존성 그래프를 조회한다. upstream=이 엔티티가 의존하는 것들, downstream=이 엔티티에 의존하는 것들. 모듈 구조나 import 체인을 시각화할 때 사용한다.',
		inputSchema: {
			type: 'object',
			properties: {
				entityKey: { type: 'string', minLength: 1, description: '기준 엔티티 키. 형식: "type::name"' },
				direction: { type: 'string', enum: ['upstream', 'downstream', 'both'], default: 'both', description: 'upstream=내가 의존하는 것, downstream=나를 의존하는 것, both=양방향' },
				depth: { type: 'integer', minimum: 1, maximum: 10, default: 3, description: '그래프 탐색 깊이' },
			},
			required: ['entityKey'],
			additionalProperties: false,
		},
	},
	{
		name: 'trace_chain',
		description: '두 엔티티 사이의 최단 관계 경로를 찾는다. "A와 B가 어떻게 연결되어 있는가?"에 답한다. 간접 의존성이나 예상치 못한 영향 경로를 파악할 때 사용한다.',
		inputSchema: {
			type: 'object',
			properties: {
				fromKey: { type: 'string', minLength: 1, description: '출발 엔티티 키. 형식: "type::name"' },
				toKey: { type: 'string', minLength: 1, description: '도착 엔티티 키. 형식: "type::name"' },
			},
			required: ['fromKey', 'toKey'],
			additionalProperties: false,
		},
	},
	{
		name: 'coverage_map',
		description: '스펙 엔티티에 대한 구현 코드와 테스트의 커버리지를 매핑한다. 스펙 항목별로 "구현됨/미구현", "테스트됨/미테스트"를 식별한다. 기능 구현 전에 스펙 커버리지 현황을 확인할 때 사용한다.',
		inputSchema: {
			type: 'object',
			properties: {
				specKey: { type: 'string', minLength: 1, description: '스펙 엔티티 키. 예: "spec::di.spec", "spec::pipeline.spec"' },
			},
			required: ['specKey'],
			additionalProperties: false,
		},
	},
	{
		name: 'inconsistency_report',
		description: 'KB 내 데이터 불일치를 검출한다. structural=깨진 참조·고아 관계·누락된 엔티티, semantic=stale 데이터·해시 불일치·버전 충돌. KB 데이터 품질이 의심될 때 사용한다.',
		inputSchema: {
			type: 'object',
			properties: {
				scope: { type: 'string', enum: ['structural', 'semantic', 'full'], default: 'full', description: 'structural=구조적 불일치만, semantic=의미적 불일치만, full=둘 다' },
			},
			additionalProperties: false,
		},
	},
	{
		name: 'find_orphans',
		description: '관계가 하나도 없는 고아 엔티티를 찾는다. 삭제된 파일의 잔여 엔티티나, 어디서도 참조되지 않는 모듈을 식별할 때 사용한다. 정리 작업의 후보를 파악하는 데 유용하다.',
		inputSchema: {
			type: 'object',
			properties: {
				entityType: { type: 'string', description: '특정 타입의 고아만 필터링. 예: module, file, class. 미지정 시 전체 타입.' },
			},
			additionalProperties: false,
		},
	},

	// ── Temporal ────────────────────────────────────────────
	{
		name: 'recent_changes',
		description: '최근 변경된 엔티티 목록을 시간순으로 조회한다. 작업 시작 시 "마지막으로 뭐가 바뀌었는가?"를 파악하거나, 특정 시점 이후의 변경 사항을 추적할 때 사용한다.',
		inputSchema: {
			type: 'object',
			properties: {
				since: { type: 'string', description: '이 시점 이후의 변경만 조회. ISO 8601 형식. 예: "2026-02-07T00:00:00Z"' },
				limit: { type: 'integer', minimum: 1, maximum: 200, default: 50, description: '반환할 최대 결과 수' },
			},
			additionalProperties: false,
		},
	},
	{
		name: 'changelog',
		description: '특정 엔티티의 변경 이력을 시간순으로 조회한다. 언제, 어떤 동기화에서 변경되었는지 추적한다. 엔티티의 변경 히스토리가 필요할 때 사용한다.',
		inputSchema: {
			type: 'object',
			properties: {
				entityKey: { type: 'string', minLength: 1, description: '조회할 엔티티 키. 형식: "type::name"' },
				limit: { type: 'integer', minimum: 1, maximum: 200, default: 50, description: '반환할 최대 이력 수' },
			},
			required: ['entityKey'],
			additionalProperties: false,
		},
	},

	// ── Operations ──────────────────────────────────────────
	{
		name: 'kb_health',
		description: 'KB 시스템 전체 상태를 한눈에 확인한다: DB 연결 상태, 파일 감시(watch) 동작 여부, 동기화 큐 깊이, 엔티티·관계·팩트 수, 캐시 적중률, 초기 스캔 완료 여부. 작업을 시작하기 전에 가장 먼저 호출하여 시스템이 정상인지 확인해야 한다.',
		inputSchema: {
			type: 'object',
			properties: {},
			additionalProperties: false,
		},
	},
	{
		name: 'verify_integrity',
		description: 'KB 데이터의 무결성을 검증한다: 깨진 참조, stale 엔티티, 해시 불일치 등을 검출한다. 코드 변경 작업 후에 반드시 실행하여 KB가 일관된 상태인지 확인해야 한다.',
		inputSchema: {
			type: 'object',
			properties: {
				level: { type: 'string', enum: ['structural', 'semantic', 'full'], default: 'full', description: 'structural=참조 무결성, semantic=해시·stale 검증, full=둘 다' },
			},
			additionalProperties: false,
		},
	},
	{
		name: 'sync',
		description: '파일 시스템의 변경 사항을 KB에 수동으로 동기화한다. stale 데이터가 있을 때 즉시 반영하거나, 코드 변경 후 KB를 최신 상태로 갱신할 때 사용한다. dryRun=true로 변경 대상만 미리 확인할 수 있다.',
		inputSchema: {
			type: 'object',
			properties: {
				scope: { type: 'string', enum: ['full', 'changed'], default: 'full', description: 'full=전체 파일 재스캔, changed=변경 감지된 파일만 동기화' },
				dryRun: { type: 'boolean', default: false, description: 'true면 실제 동기화 없이 변경 대상 목록만 반환' },
			},
			additionalProperties: false,
		},
	},
	{
		name: 'purge_tombstones',
		description: '삭제 표시(tombstone)된 오래된 엔티티를 영구 제거한다. 파일 삭제 시 엔티티는 즉시 제거되지 않고 tombstone으로 표시되는데, 이 도구로 일정 기간이 지난 tombstone을 정리한다.',
		inputSchema: {
			type: 'object',
			properties: {
				olderThan: { type: 'integer', description: '이 일수보다 오래된 tombstone만 제거. 미지정 시 기본값 적용.' },
				workspaceId: { type: 'string', description: '특정 워크스페이스의 tombstone만 제거. 미지정 시 현재 워크스페이스.' },
			},
			additionalProperties: false,
		},
	},

	// ── Bulk ────────────────────────────────────────────────
	{
		name: 'bulk_describe',
		description: '여러 엔티티의 프로필을 한 번에 조회한다. describe를 반복 호출하는 대신 이 도구를 사용하면 효율적이다. 최대 50개까지 일괄 조회 가능.',
		inputSchema: {
			type: 'object',
			properties: {
				entityKeys: { type: 'array', items: { type: 'string', minLength: 1 }, minItems: 1, maxItems: 50, description: '조회할 엔티티 키 배열. 각 항목 형식: "type::name"' },
			},
			required: ['entityKeys'],
			additionalProperties: false,
		},
	},
	{
		name: 'bulk_facts',
		description: '여러 엔티티의 팩트를 한 번에 조회한다. facts를 반복 호출하는 대신 이 도구를 사용하면 효율적이다. factType으로 특정 타입만 필터링 가능.',
		inputSchema: {
			type: 'object',
			properties: {
				entityKeys: { type: 'array', items: { type: 'string', minLength: 1 }, minItems: 1, maxItems: 50, description: '조회할 엔티티 키 배열. 각 항목 형식: "type::name"' },
				factType: { type: 'string', description: '특정 팩트 타입만 필터링. 예: export, dependency, config' },
			},
			required: ['entityKeys'],
			additionalProperties: false,
		},
	},
] as const;

// ── Server Factory ──────────────────────────────────────────

export function createBunnerKbServer(options?: { envSource?: Record<string, string | undefined> }) {
	const server = new Server(
		{ name: 'bunner-kb', version: '0.2.0' },
		{ capabilities: { tools: {} } },
	);

	// ── Lazy-init state ──────────────────────────────────────
	let initialized = false;
	let db: Db;
	let config: KBConfig;
	let workspaceId: string;
	let repoRoot: string;
	let queue: SyncQueue;
	let hashCache: HashCache;
	let worker: SyncWorker;
	let watcher: FileWatcher;
	let validator: ReadThroughValidator;
	let queryTools: QueryTools;
	let analysisTools: AnalysisTools;
	let temporalTools: TemporalTools;
	let operationsTools: OperationsTools;

	async function ensureInit(): Promise<void> {
		if (initialized) return;

		// 1. Environment → DB
		const envSource = options?.envSource ?? Bun.env;
		const env = readEnv(envSource as Record<string, string | undefined>);
		db = await createDb(env.kbDatabaseUrl);

		// 2. Workspace
		repoRoot = process.cwd();
		workspaceId = computeWorkspaceId(repoRoot);

		// 3. Config
		config = await loadConfig(repoRoot);

		// 4. Infrastructure modules
		queue = new SyncQueue();
		hashCache = new HashCache();
		const registry = createDefaultRegistry();

		validator = new ReadThroughValidator({
			hashCache,
			queue,
			repoRoot,
			enabled: config.sync.readThroughValidation,
		});

		watcher = new FileWatcher({ queue, hashCache, config, repoRoot });

		worker = new SyncWorker({
			db,
			queue,
			hashCache,
			config,
			registry,
			workspaceId,
			repoRoot,
		});

		// 5. Tool classes
		queryTools = new QueryTools(db, validator, workspaceId);
		analysisTools = new AnalysisTools(db, workspaceId);
		temporalTools = new TemporalTools(db, workspaceId);
		operationsTools = new OperationsTools(db, workspaceId, {
			queue,
			worker,
			watcher,
			hashCache,
			config,
			repoRoot,
		});

		// 6. §8.1 Background startup (non-blocking)
		//    서버 즉시 시작 → full scan은 background. scan 중 쿼리 가능 (stale 허용)
		void worker.start().catch((err: unknown) => {
			const msg = err instanceof Error ? err.message : String(err);
			kbLog.error('sync-worker', `Worker start failed: ${msg}`);
		});

		watcher.start();

		kbLog.info('server', 'KB server initialized', { workspaceId, repoRoot });
		initialized = true;
	}

	// ── ListTools ────────────────────────────────────────────

	server.setRequestHandler(ListToolsRequestSchema, async () => {
		return { tools: [...TOOL_DEFINITIONS] };
	});

	// ── CallTool ─────────────────────────────────────────────

	server.setRequestHandler(CallToolRequestSchema, async (request) => {
		const { name: toolName, arguments: args = {} } = request.params;

		try {
			await ensureInit();
		} catch (error) {
			const detail = error instanceof Error ? error.message : String(error);
			return errorResponse(toolName, `Init failed: ${detail}`);
		}

		try {
			const toolStart = Date.now();

			const dispatch = async (): Promise<ReturnType<typeof jsonResponse>> => {
				switch (toolName) {
				// ── Query ───────────────────────────────────

				case 'search': {
					const { query, limit, filters, mode } = args as {
						query: string;
						limit?: number;
						filters?: { entityType?: string; factType?: string };
						mode?: string;
					};
					const searchParams: Parameters<typeof queryTools.search>[0] = { query, limit: limit ?? config.search.defaultLimit };
					if (filters?.entityType) searchParams.entityType = filters.entityType;
					if (filters?.factType) searchParams.factType = filters.factType;
					const result = await queryTools.search(searchParams);
					void mode; // TODO: mode selection
					return jsonResponse(result);
				}

				case 'describe': {
					const { entityKey } = args as { entityKey: string };
					const result = await queryTools.describe(entityKey);
					return jsonResponse(result ?? { entity: null });
				}

				case 'relations': {
					const a = args as Record<string, unknown>;
					const relParams: Parameters<typeof queryTools.relations>[0] = { entityKey: a.entityKey as string };
					if (a.direction) relParams.direction = a.direction as 'outgoing' | 'incoming' | 'both';
					if (a.relationType) relParams.relationType = a.relationType as string;
					if (a.depth != null) relParams.depth = a.depth as number;
					if (a.limit != null) relParams.limit = a.limit as number;
					const result = await queryTools.relations(relParams);
					return jsonResponse(result);
				}

				case 'facts': {
					const fa = args as Record<string, unknown>;
					const factParams: Parameters<typeof queryTools.facts>[0] = { entityKey: fa.entityKey as string };
					if (fa.factType) factParams.factType = fa.factType as string;
					if (fa.limit != null) factParams.limit = fa.limit as number;
					const result = await queryTools.facts(factParams);
					return jsonResponse(result);
				}

				case 'evidence': {
					const { relationId } = args as { relationId: number };
					const result = await queryTools.evidence(relationId);
					return jsonResponse({ evidence: result });
				}

				// ── Analysis ────────────────────────────────

				case 'impact_analysis': {
					const { entityKey, depth } = args as { entityKey: string; depth?: number };
					const result = await analysisTools.impactAnalysis(entityKey, depth);
					return jsonResponse(result);
				}

				case 'dependency_graph': {
					const dg = args as Record<string, unknown>;
					const dgParams: Parameters<typeof analysisTools.dependencyGraph>[0] = { entityKey: dg.entityKey as string };
					if (dg.direction) dgParams.direction = dg.direction as 'upstream' | 'downstream' | 'both';
					if (dg.depth != null) dgParams.depth = dg.depth as number;
					const result = await analysisTools.dependencyGraph(dgParams);
					return jsonResponse(result);
				}

				case 'trace_chain': {
					const { fromKey, toKey } = args as { fromKey: string; toKey: string };
					const result = await analysisTools.traceChain(fromKey, toKey);
					return jsonResponse(result);
				}

				case 'coverage_map': {
					const { specKey } = args as { specKey: string };
					const result = await analysisTools.coverageMap(specKey);
					return jsonResponse(result);
				}

				case 'inconsistency_report': {
					const { scope } = args as { scope?: 'structural' | 'semantic' | 'full' };
					const result = await analysisTools.inconsistencyReport(scope);
					return jsonResponse({ scope: scope ?? 'full', issues: result, totalIssues: result.length });
				}

				case 'find_orphans': {
					const { entityType } = args as { entityType?: string };
					const result = await analysisTools.findOrphans(entityType);
					return jsonResponse({ orphans: result, totalOrphans: result.length });
				}

				// ── Temporal ────────────────────────────────

				case 'recent_changes': {
					const rc = args as Record<string, unknown>;
					const rcParams: Parameters<typeof temporalTools.recentChanges>[0] = {};
					if (rc.since) rcParams.since = rc.since as string;
					if (rc.limit != null) rcParams.limit = rc.limit as number;
					const result = await temporalTools.recentChanges(rcParams);
					return jsonResponse(result);
				}

				case 'changelog': {
					const cl = args as Record<string, unknown>;
					const clParams: Parameters<typeof temporalTools.changelog>[0] = { entityKey: cl.entityKey as string };
					if (cl.limit != null) clParams.limit = cl.limit as number;
					const result = await temporalTools.changelog(clParams);
					return jsonResponse(result);
				}

				// ── Operations ──────────────────────────────

				case 'kb_health': {
					const result = await operationsTools.kbHealth();
					return jsonResponse(result);
				}

				case 'verify_integrity': {
					const { level } = args as { level?: 'structural' | 'semantic' | 'full' };
					const result = await operationsTools.verifyIntegrity(level);
					return jsonResponse(result);
				}

				case 'sync': {
					const sy = args as Record<string, unknown>;
					const syParams: NonNullable<Parameters<typeof operationsTools.sync>[0]> = {};
					if (sy.scope) syParams.scope = sy.scope as 'full' | 'changed';
					if (sy.dryRun != null) syParams.dryRun = sy.dryRun as boolean;
					const result = await operationsTools.sync(syParams);
					return jsonResponse(result);
				}

				case 'purge_tombstones': {
					const pt = args as Record<string, unknown>;
					const ptParams: NonNullable<Parameters<typeof operationsTools.purgeTombstones>[0]> = {};
					if (pt.olderThan != null) ptParams.olderThan = pt.olderThan as number;
					if (pt.workspaceId) ptParams.workspaceId = pt.workspaceId as string;
					const result = await operationsTools.purgeTombstones(ptParams);
					return jsonResponse(result);
				}

				// ── Bulk ────────────────────────────────────

				case 'bulk_describe': {
					const { entityKeys } = args as { entityKeys: string[] };
					const resultMap = await queryTools.bulkDescribe(entityKeys);
					const results: Record<string, unknown> = {};
					for (const [key, value] of resultMap) results[key] = value;
					return jsonResponse({ results });
				}

				case 'bulk_facts': {
					const { entityKeys, factType } = args as { entityKeys: string[]; factType?: string };
					const resultMap = await queryTools.bulkFacts(entityKeys, factType);
					const results: Record<string, unknown> = {};
					for (const [key, value] of resultMap) results[key] = value;
					return jsonResponse({ results });
				}

				default:
					return errorResponse(toolName, `Unknown tool: ${toolName}`);
			}
			};

			const result = await dispatch();
			kbLog.query(toolName, Date.now() - toolStart);
			return result;
		} catch (error) {
			const detail = error instanceof Error ? error.message : String(error);
			// Redact connection strings
			const safe = detail.replace(/postgres:\/\/[^@\s]+@/gi, 'postgres://***@');
			kbLog.error('mcp', `Tool execution failed: ${toolName}`, { tool: toolName, detail: safe });
			return errorResponse(toolName, safe);
		}
	});

	return server;
}

if (import.meta.main) {
	const transport = new StdioServerTransport();
	await createBunnerKbServer().connect(transport);
}
