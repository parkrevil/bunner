/**
 * Background Sync Worker — §3.5 Background Sync Worker
 *
 * In-memory priority queue에서 작업을 소비.
 * 파일별 처리: hash check → parser registry → extract → diff → commit (single TX).
 * 각 변경마다 sync_event 기록 (audit trail).
 *
 * 단일 worker (순차 처리). 동시 sync 충돌 방지.
 * 에러 격리: 개별 파일 실패는 해당 파일만 skip.
 *
 * 최적화:
 * - commitExtraction: drizzle 트랜잭션으로 원자적 커밋
 * - loadExistingEntities: full sync 세션 동안 메모리 캐시
 * - handleDeletedFile / startupScan tombstone: 트랜잭션
 *
 * @see MCP_PLAN §3.5, §3.7, §2.8
 */

import { resolve } from 'node:path';
import type { Db, DbLike } from './db';
import type { SyncQueue, SyncTrigger } from './sync-queue';
import type { HashCache } from './hash-cache';
import type { KBConfig } from './config';
import type { ParserRegistry } from './parsers/registry';
import type { ExtractionResult, EntityRef } from './parsers/types';
import { createKb, type Id } from './kb';
import { computeContentHash, scanFiles } from './scanner';
import { kbLog } from './logger';
import { and, eq, sql } from 'drizzle-orm';
import * as schema from '../drizzle/schema';

export type SyncWorkerDeps = {
	db: Db;
	queue: SyncQueue;
	hashCache: HashCache;
	config: KBConfig;
	registry: ParserRegistry;
	workspaceId: string;
	repoRoot: string;
};

export type WorkerStatus = 'idle' | 'running' | 'stopped';

export type SyncStats = {
	filesScanned: number;
	entitiesCreated: number;
	entitiesUpdated: number;
	entitiesTombstoned: number;
	factsCreated: number;
	relationsCreated: number;
	errors: { path: string; error: string }[];
};

export class SyncWorker {
	private deps: SyncWorkerDeps;
	private kb: ReturnType<typeof createKb>;
	private _status: WorkerStatus = 'idle';
	private _running = false;
	private _startupComplete = false;
	private _lastSyncAt: Date | null = null;
	private _lastSyncDurationMs = 0;

	/** full sync 세션 동안 entity 캐시 — loadExistingEntities() 반복 호출 방지 */
	private _entityCache: Map<string, EntityRef> | null = null;

	constructor(deps: SyncWorkerDeps) {
		this.deps = deps;
		this.kb = createKb(deps.db);
	}

	get status(): WorkerStatus {
		return this._status;
	}

	get startupScanComplete(): boolean {
		return this._startupComplete;
	}

	get lastSyncAt(): Date | null {
		return this._lastSyncAt;
	}

	get lastSyncDurationMs(): number {
		return this._lastSyncDurationMs;
	}

	/**
	 * Worker 메인 루프 시작. background에서 무한 루프로 queue 소비.
	 */
	async start(): Promise<void> {
		if (this._running) return;
		this._running = true;

		// Workspace 등록
		const { hostname } = await import('node:os');
		await this.kb.ensureWorkspace(this.deps.workspaceId, hostname(), this.deps.repoRoot);

		// Layer 1: Startup Background Full Scan
		if (this.deps.config.sync.fullScanOnStartup) {
			this.startupScan().catch((err: unknown) => {
				kbLog.error('sync', 'Startup scan failed', { error: String(err) });
			});
		} else {
			this._startupComplete = true;
		}

		// Worker loop
		this.workerLoop().catch((err: unknown) => {
			kbLog.error('sync', 'Worker loop stopped', { error: String(err) });
			this._status = 'stopped';
		});
	}

	/**
	 * Worker 정지.
	 */
	stop(): void {
		this._running = false;
		this._status = 'stopped';
	}

	/**
	 * Layer 1: Startup Background Full Scan — §3.2
	 */
	private async startupScan(): Promise<void> {
		try {
			const scanned = await scanFiles(this.deps.repoRoot, this.deps.config);

			// 스캔된 파일의 hash를 캐시에 저장
			for (const f of scanned) {
				try {
					const absPath = resolve(this.deps.repoRoot, f.filePath);
					const bunFile = Bun.file(absPath);
					const exists = await bunFile.exists();
					if (exists) {
						this.deps.hashCache.set(f.filePath, {
							contentHash: f.contentHash,
							mtime: Date.now(),
						});
					}
				} catch {
					// 캐시 저장 실패 → 무시
				}
			}

			// DB에 있지만 파일 시스템에 없는 entity → tombstone 대상 파악
			const dbSources = await this.deps.db.execute(sql`
				SELECT DISTINCT s.file_path, s.content_hash, e.id as entity_id, e.entity_key, e.is_deleted
				FROM source s
				JOIN entity e ON e.id = s.entity_id
				WHERE s.workspace_id = ${this.deps.workspaceId}
			`);

			const scannedPaths = new Set(scanned.map((f) => f.filePath));
			const scannedMap = new Map(scanned.map((f) => [f.filePath, f.contentHash]));

			// 변경/삭제 판별
			const changedFiles: string[] = [];
			const deletedEntityIds: number[] = [];

			for (const row of dbSources.rows as Array<{ file_path: string; content_hash: string; entity_id: number; entity_key: string; is_deleted: boolean }>) {
				if (!scannedPaths.has(row.file_path)) {
					if (!row.is_deleted) {
						deletedEntityIds.push(row.entity_id);
					}
				} else {
					const newHash = scannedMap.get(row.file_path);
					if (newHash && newHash !== row.content_hash) {
						changedFiles.push(row.file_path);
					}
				}
			}

			// 새 파일 (DB에 없음)
			const dbPaths = new Set((dbSources.rows as Array<{ file_path: string }>).map((r) => r.file_path));
			const newFiles = scanned.filter((f) => !dbPaths.has(f.filePath)).map((f) => f.filePath);

			// Tombstone 처리 — 트랜잭션으로 원자적 처리
			if (deletedEntityIds.length > 0) {
				await this.deps.db.transaction(async (tx) => {
					const txKb = createKb(tx);
					const runId = await txKb.beginSyncRun(this.deps.workspaceId, 'startup');
					for (const entityId of deletedEntityIds) {
						await txKb.tombstoneEntity(entityId, runId);
					}
					await txKb.finishSyncRun(runId, 'completed', { tombstoned: deletedEntityIds.length });
				});
			}

			// entity 캐시 워밍업 — 이후 processFile에서 재사용
			this._entityCache = await this.loadExistingEntities(this.deps.db);

			// 변경/신규 파일을 queue에 enqueue
			this.deps.queue.enqueueBatch([...changedFiles, ...newFiles], 'startup');

			this._startupComplete = true;
		} catch {
			this._startupComplete = true; // 실패해도 startup 완료로 표기 (§3.7)
		}
	}

	/**
	 * Worker 메인 루프 — queue에서 항목을 하나씩 꺼내 처리.
	 */
	private async workerLoop(): Promise<void> {
		while (this._running) {
			await this.deps.queue.waitForItem();
			if (!this._running) break;

			const item = this.deps.queue.dequeue();
			if (!item) continue;

			this._status = 'running';
			const startTime = Date.now();

			try {
				await this.processFile(item.filePath, item.trigger);
				kbLog.sync(`Processed file`, { filePath: item.filePath, trigger: item.trigger, durationMs: Date.now() - startTime });
			} catch (err: unknown) {
				kbLog.error('sync', `File processing failed: ${item.filePath}`, { filePath: item.filePath, error: String(err) });
			}

			this._lastSyncAt = new Date();
			this._lastSyncDurationMs = Date.now() - startTime;

			// queue가 비면 entity 캐시 무효화 (다음 batch에서 fresh load)
			if (this.deps.queue.depth === 0) {
				this._entityCache = null;
			}

			this._status = 'idle';
		}
	}

	/**
	 * 개별 파일 처리: hash check → parse → diff → commit.
	 */
	private async processFile(filePath: string, trigger: SyncTrigger): Promise<void> {
		const absPath = resolve(this.deps.repoRoot, filePath);
		const bunFile = Bun.file(absPath);

		// 파일 존재 여부 확인
		const exists = await bunFile.exists();
		if (!exists) {
			// 파일 삭제됨 → 해당 source의 entity tombstone
			await this.handleDeletedFile(filePath, trigger);
			return;
		}

		// content_hash 계산
		const contentHash = await computeContentHash(absPath);

		// hash cache 업데이트
		this.deps.hashCache.set(filePath, {
			contentHash,
			mtime: Date.now(),
		});

		// DB의 기존 source hash와 비교
		const existingSource = await this.deps.db.execute(sql`
			SELECT content_hash FROM source
			WHERE workspace_id = ${this.deps.workspaceId} AND file_path = ${filePath}
			LIMIT 1
		`);

		const existingHash = (existingSource.rows[0] as { content_hash?: string } | undefined)?.content_hash;
		if (existingHash === contentHash) {
			return; // no-op — content_hash 동일
		}

		// 파일 내용 읽기
		const content = await bunFile.text();

		// 기존 entity 맵 (캐시 활용 — full sync 시 한 번만 DB 조회)
		if (!this._entityCache) {
			this._entityCache = await this.loadExistingEntities(this.deps.db);
		}
		const entityMap = this._entityCache;

		// Parser registry → extract
		const extracted = this.deps.registry.extractAll(
			filePath,
			content,
			{
				workspaceId: this.deps.workspaceId,
				filePath,
				contentHash,
				existingEntities: entityMap,
			},
			this.deps.config,
		);

		// Commit (single TX)
		await this.commitExtraction(extracted, filePath, contentHash, trigger);
	}

	/**
	 * 삭제된 파일 처리 — 해당 source의 entity를 tombstone.
	 * 트랜잭션으로 원자적 처리.
	 */
	private async handleDeletedFile(filePath: string, trigger: SyncTrigger): Promise<void> {
		const entities = await this.deps.db.execute(sql`
			SELECT DISTINCT e.id, e.entity_key
			FROM source s
			JOIN entity e ON e.id = s.entity_id
			WHERE s.workspace_id = ${this.deps.workspaceId}
			  AND s.file_path = ${filePath}
			  AND e.is_deleted = false
		`);

		if (entities.rows.length === 0) return;

		await this.deps.db.transaction(async (tx) => {
			const txKb = createKb(tx);
			const runId = await txKb.beginSyncRun(this.deps.workspaceId, trigger);

			for (const row of entities.rows as Array<{ id: number; entity_key: string }>) {
				// entity의 다른 source가 있는지 확인
				const otherSources = await tx.execute(sql`
					SELECT id FROM source
					WHERE entity_id = ${row.id} AND file_path != ${filePath}
					LIMIT 1
				`);

				if (otherSources.rows.length === 0) {
					// 이 파일이 유일한 source → tombstone
					await txKb.tombstoneEntity(row.id, runId);

					// entity 캐시에서 제거
					this._entityCache?.delete(row.entity_key);
				}
			}

			// source 행 삭제
			await tx.execute(sql`
				DELETE FROM source
				WHERE workspace_id = ${this.deps.workspaceId} AND file_path = ${filePath}
			`);

			await txKb.finishSyncRun(runId, 'completed');
		});

		// hash cache evict
		this.deps.hashCache.evict(filePath);
	}

	/**
	 * 추출 결과를 DB에 커밋 — 트랜잭션으로 원자적 처리 + sync_event audit.
	 */
	private async commitExtraction(
		extracted: ExtractionResult,
		filePath: string,
		contentHash: string,
		trigger: SyncTrigger,
	): Promise<void> {
		const stats: SyncStats = {
			filesScanned: 1,
			entitiesCreated: 0,
			entitiesUpdated: 0,
			entitiesTombstoned: 0,
			factsCreated: 0,
			relationsCreated: 0,
			errors: [],
		};

		try {
			await this.deps.db.transaction(async (tx) => {
				const txKb = createKb(tx);
				const runId = await txKb.beginSyncRun(this.deps.workspaceId, trigger);

				// entity_key → entity_id 매핑
				const entityIdMap = new Map<string, Id>();

				// 1. Entities upsert
				for (const draft of extracted.entities) {
					try {
						const entityInput: Parameters<typeof txKb.upsertEntity>[0] = {
							workspaceId: this.deps.workspaceId,
							entityKey: draft.entityKey,
							entityType: draft.entityType,
						};
						if (draft.summary) entityInput.summary = draft.summary;
						if (draft.meta) entityInput.meta = draft.meta;
						const entityId = await txKb.upsertEntity(entityInput, runId);
						entityIdMap.set(draft.entityKey, entityId);

						// entity 캐시 업데이트
						this._entityCache?.set(draft.entityKey, {
							id: entityId,
							entityKey: draft.entityKey,
							entityType: draft.entityType,
						});

						// audit event
						await txKb.recordSyncEvent(runId, entityId, 'created', undefined, contentHash);
						stats.entitiesCreated++;
					} catch (err) {
						stats.errors.push({ path: filePath, error: `entity ${draft.entityKey}: ${String(err)}` });
					}
				}

				// 2. Sources upsert
				for (const draft of extracted.sources) {
					const entityId = entityIdMap.get(draft.entityKey);
					if (!entityId) continue;

					try {
						const sourceInput: Parameters<typeof txKb.upsertSource>[0] = {
							workspaceId: this.deps.workspaceId,
							entityId,
							kind: draft.kind,
							filePath: draft.filePath,
							contentHash,
						};
						if (draft.spanStart != null) sourceInput.spanStart = draft.spanStart;
						if (draft.spanEnd != null) sourceInput.spanEnd = draft.spanEnd;
						await txKb.upsertSource(sourceInput);
					} catch (err) {
						stats.errors.push({ path: filePath, error: `source ${draft.filePath}: ${String(err)}` });
					}
				}

				// 3. Facts upsert
				const factKeyToId = new Map<string, Id>();
				const retainedFactKeys = new Map<string, string[]>(); // entityKey → factKeys[]

				for (const draft of extracted.facts) {
					const entityId = entityIdMap.get(draft.entityKey);
					if (!entityId) continue;

					try {
						// content_hash for fact dedup
						const factContent = JSON.stringify({ text: draft.payloadText, json: draft.payloadJson });
						const factHasher = new Bun.CryptoHasher('sha256');
						factHasher.update(factContent);
						const factContentHash = factHasher.digest('hex');

						const factInput: Parameters<typeof txKb.upsertFact>[0] = {
							entityId,
							factType: draft.factType,
							factKey: draft.factKey,
							contentHash: factContentHash,
						};
						if (draft.payloadText) factInput.payloadText = draft.payloadText;
						if (draft.payloadJson) factInput.payloadJson = draft.payloadJson;
						const factId = await txKb.upsertFact(factInput);

						factKeyToId.set(`${draft.entityKey}:${draft.factKey}`, factId);

						// track retained fact keys for orphan cleanup
						const existing = retainedFactKeys.get(draft.entityKey) ?? [];
						existing.push(draft.factKey);
						retainedFactKeys.set(draft.entityKey, existing);

						stats.factsCreated++;
					} catch (err) {
						stats.errors.push({ path: filePath, error: `fact ${draft.factKey}: ${String(err)}` });
					}
				}

				// 4. Orphan fact cleanup (§2.8)
				for (const [entityKey, factKeys] of retainedFactKeys) {
					const entityId = entityIdMap.get(entityKey);
					if (!entityId) continue;
					try {
						await txKb.deleteOrphanFacts(entityId, factKeys);
					} catch {
						// non-critical
					}
				}

				// 5. Relations upsert
				for (const draft of extracted.relations) {
					const srcId = entityIdMap.get(draft.srcEntityKey);
					const dstId = entityIdMap.get(draft.dstEntityKey) ?? (await this.resolveEntityId(tx, draft.dstEntityKey));

					if (!srcId || !dstId) continue;
					if (srcId === dstId) continue; // no self-loop

					try {
						const relInput: Parameters<typeof txKb.upsertRelation>[0] = {
							srcEntityId: srcId,
							dstEntityId: dstId,
							relationType: draft.relationType,
							strength: draft.strength,
						};
						if (draft.meta) relInput.meta = draft.meta;
						const relationId = await txKb.upsertRelation(relInput);

						// Link evidence — find matching facts
						for (const [compositeKey, factId] of factKeyToId) {
							if (compositeKey.startsWith(`${draft.srcEntityKey}:`)) {
								await txKb.linkRelationEvidence(relationId, factId);
							}
						}

						stats.relationsCreated++;
					} catch (err) {
						stats.errors.push({ path: filePath, error: `relation ${draft.srcEntityKey}→${draft.dstEntityKey}: ${String(err)}` });
					}
				}

				await txKb.finishSyncRun(runId, 'completed', stats as unknown as Record<string, unknown>, stats.errors);
			});
		} catch (err) {
			// 트랜잭션 자체가 실패한 경우 — 별도로 에러 기록
			try {
				const runId = await this.kb.beginSyncRun(this.deps.workspaceId, trigger);
				await this.kb.finishSyncRun(runId, 'failed', undefined, [{ path: filePath, error: String(err) }]);
			} catch {
				kbLog.error('sync', `Failed to record sync failure for ${filePath}`, { error: String(err) });
			}
		}
	}

	/**
	 * 기존 entity 맵 로드.
	 * executor를 받아 db/tx 모두에서 동작.
	 */
	private async loadExistingEntities(executor: DbExecutor): Promise<Map<string, EntityRef>> {
		const rows = await executor
			.select({
				id: schema.entity.id,
				entityKey: schema.entity.entityKey,
				entityType: schema.entityType.name,
			})
			.from(schema.entity)
			.innerJoin(schema.entityType, eq(schema.entityType.id, schema.entity.entityTypeId))
			.where(and(eq(schema.entity.workspaceId, this.deps.workspaceId), eq(schema.entity.isDeleted, false)));

		const map = new Map<string, EntityRef>();
		for (const row of rows) {
			map.set(row.entityKey, {
				id: row.id,
				entityKey: row.entityKey,
				entityType: row.entityType,
			});
		}

		return map;
	}

	/**
	 * entity_key로 entity_id 해석 (이미 DB에 있는 entity).
	 * executor를 받아 db/tx 모두에서 동작.
	 */
	private async resolveEntityId(executor: DbLike, entityKey: string): Promise<Id | undefined> {
		// 캐시 먼저 확인
		const cached = this._entityCache?.get(entityKey);
		if (cached) return cached.id;

		const rows = await executor
			.select({ id: schema.entity.id })
			.from(schema.entity)
			.where(
				and(
					eq(schema.entity.workspaceId, this.deps.workspaceId),
					eq(schema.entity.entityKey, entityKey),
					eq(schema.entity.isDeleted, false),
				),
			)
			.limit(1);

		return rows[0]?.id;
	}

	/**
	 * entity 캐시 무효화. full sync 완료 후 호출.
	 */
	invalidateEntityCache(): void {
		this._entityCache = null;
	}
}
