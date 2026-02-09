/**
 * Analysis Tools — §6.2 Analysis (분석)
 *
 * impact_analysis, dependency_graph, trace_chain, coverage_map, inconsistency_report, find_orphans
 *
 * @see MCP_PLAN §5.5, §6.2, §6.7
 */

import { sql } from 'drizzle-orm';
import { executeRows, type Db } from '../db';
import { createRepos } from '../repo';

function buildIntValuesFragment(values: number[]) {
	return sql.join(values.map((v) => sql`(${v})`), sql`,`);
}

// ── Response Types (§6.7) ────────────────────────────────────

export type ImpactAnalysisResult = {
	root: { key: string; type: string; summary: string };
	affected: {
		entityKey: string; entityType: string;
		distance: number; path: string[];
	}[];
	totalAffected: number;
};

export type DependencyGraphResult = {
	nodes: { entityKey: string; entityType: string; summary: string }[];
	edges: { src: string; dst: string; relationType: string; strength: string }[];
};

export type TraceChainResult = {
	found: boolean;
	path: { entityKey: string; entityType: string }[];
	relations: { src: string; dst: string; relationType: string }[];
};

export type CoverageMapResult = {
	specFound: boolean;
	spec: { key: string; summary: string };
	implementations: { entityKey: string; relationType: string; strength: string }[];
	tests: { entityKey: string; relationType: string; targetKey: string }[];
	gaps: { type: 'no_implementation' | 'no_test'; entityKey: string; summary: string }[];
};

export type InconsistencyItem = {
	type: 'spec_no_impl' | 'code_no_test' | 'orphan_entity' | 'dangling_relation' | 'evidenceless_relation';
	entityKey: string;
	summary: string;
	detail?: string;
};

export type OrphanItem = {
	entityKey: string;
	entityType: string;
	summary: string;
};

// ── Analysis Tools ───────────────────────────────────────────

export class AnalysisTools {
	constructor(
		private db: Db,
		private workspaceId: string,
	) {}

	/**
	 * impact_analysis — §5.5 reverse dependency BFS
	 * 변경 시 영향받는 entity 목록 (reverse dependency walk)
	 */
	async impactAnalysis(entityKey: string, depth?: number): Promise<ImpactAnalysisResult> {
		return this.db.transaction(async (tx) => {
			const repos = createRepos(tx);
			const maxDepth = depth ?? 3;
			const root = await repos.entity.findByWorkspaceKey({ workspaceId: this.workspaceId, entityKey });
			if (!root) {
				return { root: { key: entityKey, type: '', summary: '' }, affected: [], totalAffected: 0 };
			}
			const rootType = (await repos.types.getEntityTypeNameById(root.entityTypeId)) ?? '';

			// BFS — reverse dependency (incoming relations = entities that depend on this)
			type InterimAffected = {
				entityKey: string;
				entityTypeId: number;
				distance: number;
				path: string[];
			};
			const affected: InterimAffected[] = [];
			const visited = new Set<number>([root.id]);
			const queue: Array<{ entityId: number; dist: number; path: string[] }> = [
				{ entityId: root.id, dist: 0, path: [root.entityKey] },
			];

			while (queue.length > 0) {
				const currentDist = queue[0]!.dist;
				if (currentDist >= maxDepth) break;

				const batch: Array<{ entityId: number; path: string[] }> = [];
				while (queue.length > 0 && queue[0]!.dist === currentDist) {
					const item = queue.shift()!;
					batch.push({ entityId: item.entityId, path: item.path });
				}

				const viaPath = new Map<number, string[]>();
				for (const b of batch) viaPath.set(b.entityId, b.path);

				const depRows = await repos.relation.listIncomingForFrontier({
					dstEntityIds: batch.map((b) => b.entityId),
					limit: 50000,
				});
				for (const row of depRows) {
					if (visited.has(row.neighborId)) continue;
					visited.add(row.neighborId);
					const basePath = viaPath.get(row.dst.id) ?? [root.entityKey];
					const path = [...basePath, row.src.key];
					affected.push({
						entityKey: row.src.key,
						entityTypeId: row.src.typeId,
						distance: currentDist + 1,
						path,
					});
					queue.push({ entityId: row.neighborId, dist: currentDist + 1, path });
				}
			}

			const typeIds = Array.from(new Set(affected.map((a) => a.entityTypeId)));
			const typeNames = await repos.types.getEntityTypeNamesByIds(typeIds);

			return {
				root: { key: root.entityKey, type: rootType, summary: root.summary ?? '' },
				affected: affected.map((a) => ({
					entityKey: a.entityKey,
					entityType: typeNames.get(a.entityTypeId) ?? '',
					distance: a.distance,
					path: a.path,
				})),
				totalAffected: affected.length,
			};
		});
	}

	/**
	 * dependency_graph — §5.5 의존 그래프 서브트리
	 */
	async dependencyGraph(params: {
		entityKey: string;
		direction?: 'upstream' | 'downstream' | 'both';
		depth?: number;
	}): Promise<DependencyGraphResult> {
		return this.db.transaction(async (tx) => {
			const repos = createRepos(tx);
			const direction = params.direction ?? 'both';
			const maxDepth = params.depth ?? 3;
			const root = await repos.entity.findByWorkspaceKey({ workspaceId: this.workspaceId, entityKey: params.entityKey });
			if (!root) {
				return { nodes: [], edges: [] };
			}
			type Node = { entityKey: string; entityTypeId: number; summary: string | null };
			type Edge = { src: string; dst: string; relationTypeId: number; strengthTypeId: number };
			const nodes = new Map<string, Node>();
			const edges: Edge[] = [];
			const visited = new Set<number>([root.id]);
			nodes.set(root.entityKey, { entityKey: root.entityKey, entityTypeId: root.entityTypeId, summary: root.summary ?? null });

			const queue: Array<{ entityId: number; entityKey: string; dist: number }> = [
				{ entityId: root.id, entityKey: root.entityKey, dist: 0 },
			];

			while (queue.length > 0) {
				const currentDist = queue[0]!.dist;
				if (currentDist >= maxDepth) break;

				const batch: Array<{ entityId: number; entityKey: string }> = [];
				while (queue.length > 0 && queue[0]!.dist === currentDist) {
					const item = queue.shift()!;
					batch.push({ entityId: item.entityId, entityKey: item.entityKey });
				}
				const keyById = new Map<number, string>();
				for (const b of batch) keyById.set(b.entityId, b.entityKey);

				if (direction === 'downstream' || direction === 'both') {
					const downstreamRows = await repos.relation.listEdgesFrom({ srcEntityIds: batch.map((b) => b.entityId) });
					for (const row of downstreamRows) {
						const srcKey = keyById.get(row.viaId) ?? '';
						nodes.set(row.entityKey, { entityKey: row.entityKey, entityTypeId: row.entityTypeId, summary: row.summary ?? null });
						edges.push({ src: srcKey, dst: row.entityKey, relationTypeId: row.relationTypeId, strengthTypeId: row.strengthTypeId });
						if (!visited.has(row.id)) {
							visited.add(row.id);
							queue.push({ entityId: row.id, entityKey: row.entityKey, dist: currentDist + 1 });
						}
					}
				}

				if (direction === 'upstream' || direction === 'both') {
					const upstreamRows = await repos.relation.listEdgesTo({ dstEntityIds: batch.map((b) => b.entityId) });
					for (const row of upstreamRows) {
						const dstKey = keyById.get(row.viaId) ?? '';
						nodes.set(row.entityKey, { entityKey: row.entityKey, entityTypeId: row.entityTypeId, summary: row.summary ?? null });
						edges.push({ src: row.entityKey, dst: dstKey, relationTypeId: row.relationTypeId, strengthTypeId: row.strengthTypeId });
						if (!visited.has(row.id)) {
							visited.add(row.id);
							queue.push({ entityId: row.id, entityKey: row.entityKey, dist: currentDist + 1 });
						}
					}
				}
			}

			const entityTypeIds = Array.from(new Set(Array.from(nodes.values()).map((n) => n.entityTypeId)));
			const relationTypeIds = Array.from(new Set(edges.map((e) => e.relationTypeId)));
			const strengthTypeIds = Array.from(new Set(edges.map((e) => e.strengthTypeId)));
			const entityTypeNames = await repos.types.getEntityTypeNamesByIds(entityTypeIds);
			const relationTypeNames = await repos.types.getRelationTypeNamesByIds(relationTypeIds);
			const strengthTypeNames = await repos.types.getStrengthTypeNamesByIds(strengthTypeIds);

			return {
				nodes: Array.from(nodes.values()).map((n) => ({
					entityKey: n.entityKey,
					entityType: entityTypeNames.get(n.entityTypeId) ?? '',
					summary: n.summary ?? '',
				})),
				edges: edges.map((e) => ({
					src: e.src,
					dst: e.dst,
					relationType: relationTypeNames.get(e.relationTypeId) ?? '',
					strength: strengthTypeNames.get(e.strengthTypeId) ?? '',
				})),
			};
		});
	}

	/**
	 * trace_chain — §5.5 최단 관계 경로 (BFS)
	 */
	async traceChain(fromKey: string, toKey: string): Promise<TraceChainResult> {
		return this.db.transaction(async (tx) => {
			const repos = createRepos(tx);
			const fromEntity = await repos.entity.findByWorkspaceKey({ workspaceId: this.workspaceId, entityKey: fromKey });
			const toEntity = await repos.entity.findByWorkspaceKey({ workspaceId: this.workspaceId, entityKey: toKey });
			if (!fromEntity || !toEntity) {
				return { found: false, path: [], relations: [] };
			}
			const toId = toEntity.id;

			// BFS (batch per layer)
			type VisitInfo = { parentId: number | null; entityKey: string; entityTypeId: number; relationTypeId: number | null };
			const visited = new Map<number, VisitInfo>();
			visited.set(fromEntity.id, { parentId: null, entityKey: fromEntity.entityKey, entityTypeId: fromEntity.entityTypeId, relationTypeId: null });

			let frontier: number[] = [fromEntity.id];
			let found = false;

			while (frontier.length > 0 && !found) {
				const nextFrontier: number[] = [];

				const outgoingRows = await repos.relation.listOutgoingForFrontier({ srcEntityIds: frontier, limit: 50000 });
				for (const row of outgoingRows) {
					if (visited.has(row.neighborId)) continue;
					visited.set(row.neighborId, {
						parentId: row.src.id,
						entityKey: row.dst.key,
						entityTypeId: row.dst.typeId,
						relationTypeId: row.relationTypeId,
					});
					nextFrontier.push(row.neighborId);
					if (row.neighborId === toId) { found = true; break; }
				}

				if (!found) {
					const incomingRows = await repos.relation.listIncomingForFrontier({ dstEntityIds: frontier, limit: 50000 });
					for (const row of incomingRows) {
						if (visited.has(row.neighborId)) continue;
						visited.set(row.neighborId, {
							parentId: row.dst.id,
							entityKey: row.src.key,
							entityTypeId: row.src.typeId,
							relationTypeId: row.relationTypeId,
						});
						nextFrontier.push(row.neighborId);
						if (row.neighborId === toId) { found = true; break; }
					}
				}

				frontier = nextFrontier;
			}

			if (!found) {
				return { found: false, path: [], relations: [] };
			}

			// Reconstruct path
			const pathInternal: { entityKey: string; entityTypeId: number }[] = [];
			const relInternal: { src: string; dst: string; relationTypeId: number }[] = [];
			let currentId: number | null = toId;

			while (currentId !== null) {
				const info: VisitInfo = visited.get(currentId)!;
				pathInternal.unshift({ entityKey: info.entityKey, entityTypeId: info.entityTypeId });
				if (info.parentId !== null && info.relationTypeId != null) {
					const parentInfo = visited.get(info.parentId)!;
					relInternal.unshift({ src: parentInfo.entityKey, dst: info.entityKey, relationTypeId: info.relationTypeId });
				}
				currentId = info.parentId;
			}

			const entityTypeIds = Array.from(new Set(pathInternal.map((p) => p.entityTypeId)));
			const relationTypeIds = Array.from(new Set(relInternal.map((r) => r.relationTypeId)));
			const entityTypeNames = await repos.types.getEntityTypeNamesByIds(entityTypeIds);
			const relationTypeNames = await repos.types.getRelationTypeNamesByIds(relationTypeIds);

			return {
				found: true,
				path: pathInternal.map((p) => ({ entityKey: p.entityKey, entityType: entityTypeNames.get(p.entityTypeId) ?? '' })),
				relations: relInternal.map((r) => ({ src: r.src, dst: r.dst, relationType: relationTypeNames.get(r.relationTypeId) ?? '' })),
			};
		});
	}

	/**
	 * coverage_map — §5.5 spec → code → test 커버리지
	 */
	async coverageMap(specKey: string): Promise<CoverageMapResult> {
		return this.db.transaction(async (tx) => {
			const specRows = await executeRows(tx, sql`
				SELECT e.id, e.entity_key, e.summary
				FROM entity e
				JOIN entity_type et ON et.id = e.entity_type_id
				WHERE e.workspace_id = ${this.workspaceId}
				  AND e.entity_key = ${specKey}
				  AND et.name = 'spec'
				LIMIT 1
			`);

			if (specRows.length === 0) {
				return { specFound: false, spec: { key: specKey, summary: '' }, implementations: [], tests: [], gaps: [] };
			}

			const spec = specRows[0] as { id: number; entity_key: string; summary: string };
			const gaps: CoverageMapResult['gaps'] = [];

			// Implementations: entities that implement this spec
			const implRows = await executeRows(tx, sql`
				SELECT e.id, e.entity_key, rt.name as relation_type, st.name as strength
				FROM relation r
				JOIN entity e ON e.id = r.src_entity_id
				JOIN relation_type rt ON rt.id = r.relation_type_id
				JOIN strength_type st ON st.id = r.strength_type_id
				WHERE r.dst_entity_id = ${spec.id}
				  AND rt.name = 'implements'
				  AND e.is_deleted = false
			`);

			const implementations = (implRows as Array<{
				id: number; entity_key: string; relation_type: string; strength: string;
			}>).map((r) => ({
				entityId: r.id,
				entityKey: r.entity_key,
				relationType: r.relation_type,
				strength: r.strength,
			}));

			if (implementations.length === 0) {
				gaps.push({ type: 'no_implementation', entityKey: spec.entity_key, summary: spec.summary ?? '' });
			}

			// Tests: entities that test the implementations (set-based)
			const tests: CoverageMapResult['tests'] = [];
			if (implementations.length > 0) {
				const implIdToKey = new Map<number, string>();
				for (const impl of implementations) implIdToKey.set(impl.entityId, impl.entityKey);
				const implIdsList = buildIntValuesFragment(implementations.map((i) => i.entityId));
				const testRows = await executeRows(tx, sql`
					WITH impl_ids(id) AS (VALUES ${implIdsList})
					SELECT r.dst_entity_id as target_id, te.entity_key as test_key, rt.name as relation_type
					FROM relation r
					JOIN impl_ids ON impl_ids.id = r.dst_entity_id
					JOIN entity te ON te.id = r.src_entity_id
					JOIN relation_type rt ON rt.id = r.relation_type_id
					WHERE rt.name = 'tests'
					  AND te.is_deleted = false
				`);

				const testsByTargetId = new Map<number, Array<{ testKey: string; relationType: string }>>();
				for (const row of testRows as Array<{ target_id: number; test_key: string; relation_type: string }>) {
					const list = testsByTargetId.get(row.target_id) ?? [];
					list.push({ testKey: row.test_key, relationType: row.relation_type });
					testsByTargetId.set(row.target_id, list);
				}

				for (const impl of implementations) {
					const foundTests = testsByTargetId.get(impl.entityId) ?? [];
					if (foundTests.length === 0) {
						gaps.push({ type: 'no_test', entityKey: impl.entityKey, summary: `No tests for ${impl.entityKey}` });
						continue;
					}
					for (const t of foundTests) {
						tests.push({ entityKey: t.testKey, relationType: t.relationType, targetKey: impl.entityKey });
					}
				}
			}

			return {
				specFound: true,
				spec: { key: spec.entity_key, summary: spec.summary ?? '' },
				implementations: implementations.map((i) => ({ entityKey: i.entityKey, relationType: i.relationType, strength: i.strength })),
				tests,
				gaps,
			};
		});
	}

	/**
	 * inconsistency_report — §5.5 불일치/누락 검출
	 * 독립적인 쿼리를 scope별로 병렬 실행.
	 */
	async inconsistencyReport(scope?: 'structural' | 'semantic' | 'full'): Promise<InconsistencyItem[]> {
		return this.db.transaction(async (tx) => {
			const level = scope ?? 'full';
			const items: InconsistencyItem[] = [];

			if (level === 'structural' || level === 'full') {
				const danglingRows = await executeRows(tx, sql`
					SELECT r.id, se.entity_key as src_key, de.entity_key as dst_key
					FROM relation r
					JOIN entity se ON se.id = r.src_entity_id
					JOIN entity de ON de.id = r.dst_entity_id
					WHERE (se.is_deleted = true OR de.is_deleted = true)
					  AND se.workspace_id = ${this.workspaceId}
				`);
				for (const row of danglingRows as Array<{ src_key: string; dst_key: string }>) {
					items.push({
						type: 'dangling_relation',
						entityKey: row.src_key,
						summary: `Dangling relation: ${row.src_key} → ${row.dst_key} (one side is tombstoned)`,
					});
				}

				const noEvidenceRows = await executeRows(tx, sql`
					SELECT r.id, se.entity_key as src_key, de.entity_key as dst_key
					FROM relation r
					JOIN entity se ON se.id = r.src_entity_id
					JOIN entity de ON de.id = r.dst_entity_id
					LEFT JOIN relation_evidence re ON re.relation_id = r.id
					WHERE re.relation_id IS NULL
					  AND se.workspace_id = ${this.workspaceId}
				`);
				for (const row of noEvidenceRows as Array<{ src_key: string; dst_key: string }>) {
					items.push({
						type: 'evidenceless_relation',
						entityKey: row.src_key,
						summary: `Relation without evidence: ${row.src_key} → ${row.dst_key}`,
					});
				}
			}

			if (level === 'semantic' || level === 'full') {
				const specsNoImplRows = await executeRows(tx, sql`
					SELECT e.entity_key, e.summary
					FROM entity e
					JOIN entity_type et ON et.id = e.entity_type_id
					WHERE et.name = 'spec'
					  AND e.workspace_id = ${this.workspaceId}
					  AND e.is_deleted = false
					  AND NOT EXISTS (
						SELECT 1 FROM relation r
						JOIN relation_type rt ON rt.id = r.relation_type_id
						WHERE r.dst_entity_id = e.id AND rt.name = 'implements'
					  )
				`);
				for (const row of specsNoImplRows as Array<{ entity_key: string; summary: string }>) {
					items.push({
						type: 'spec_no_impl',
						entityKey: row.entity_key,
						summary: `Spec without implementation: ${row.entity_key}`,
					});
				}

				const codeNoTestRows = await executeRows(tx, sql`
					SELECT e.entity_key, e.summary
					FROM entity e
					JOIN entity_type et ON et.id = e.entity_type_id
					WHERE et.name IN ('module', 'symbol')
					  AND e.workspace_id = ${this.workspaceId}
					  AND e.is_deleted = false
					  AND NOT EXISTS (
						SELECT 1 FROM relation r
						JOIN relation_type rt ON rt.id = r.relation_type_id
						WHERE r.dst_entity_id = e.id AND rt.name = 'tests'
					  )
				`);
				for (const row of codeNoTestRows as Array<{ entity_key: string; summary: string }>) {
					items.push({
						type: 'code_no_test',
						entityKey: row.entity_key,
						summary: `Code without tests: ${row.entity_key}`,
					});
				}
			}

			return items;
		});
	}

	/**
	 * find_orphans — §5.5 어떤 relation도 없는 고립 entity
	 */
	async findOrphans(entityType?: string): Promise<OrphanItem[]> {
		return this.db.transaction(async (tx) => {
			let typeFilter = sql`true`;
			if (entityType) {
				typeFilter = sql`et.name = ${entityType}`;
			}

			const rows = await executeRows(tx, sql`
				SELECT e.entity_key, et.name as entity_type, e.summary
				FROM entity e
				JOIN entity_type et ON et.id = e.entity_type_id
				WHERE e.workspace_id = ${this.workspaceId}
				  AND e.is_deleted = false
				  AND ${typeFilter}
				  AND NOT EXISTS (
					SELECT 1 FROM relation r WHERE r.src_entity_id = e.id OR r.dst_entity_id = e.id
				  )
			`);

			return (rows as Array<{ entity_key: string; entity_type: string; summary: string }>).map((r) => ({
				entityKey: r.entity_key,
				entityType: r.entity_type,
				summary: r.summary ?? '',
			}));
		});
	}
}
