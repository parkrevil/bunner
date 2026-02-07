/**
 * Analysis Tools — §6.2 Analysis (분석)
 *
 * impact_analysis, dependency_graph, trace_chain, coverage_map, inconsistency_report, find_orphans
 *
 * @see MCP_PLAN §5.5, §6.2, §6.7
 */

import { sql } from 'drizzle-orm';
import type { Db } from '../db';

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
		const maxDepth = depth ?? 3;

		const rootResult = await this.db.execute(sql`
			SELECT e.id, e.entity_key, et.name as entity_type, e.summary
			FROM entity e
			JOIN entity_type et ON et.id = e.entity_type_id
			WHERE e.workspace_id = ${this.workspaceId} AND e.entity_key = ${entityKey}
			LIMIT 1
		`);

		if (rootResult.rows.length === 0) {
			return { root: { key: entityKey, type: '', summary: '' }, affected: [], totalAffected: 0 };
		}

		const root = rootResult.rows[0] as { id: number; entity_key: string; entity_type: string; summary: string };

		// BFS — reverse dependency (incoming relations = entities that depend on this)
		const affected: ImpactAnalysisResult['affected'] = [];
		const visited = new Set<number>([root.id]);
		const queue: Array<{ entityId: number; dist: number; path: string[] }> = [
			{ entityId: root.id, dist: 0, path: [root.entity_key] },
		];

		while (queue.length > 0) {
			const current = queue.shift()!;
			if (current.dist >= maxDepth) continue;

			// 이 entity에 의존하는 entity들 (incoming: src depends on dst=current)
			const deps = await this.db.execute(sql`
				SELECT e.id, e.entity_key, et.name as entity_type, e.summary
				FROM relation r
				JOIN entity e ON e.id = r.src_entity_id
				JOIN entity_type et ON et.id = e.entity_type_id
				WHERE r.dst_entity_id = ${current.entityId}
				  AND e.is_deleted = false
			`);

			for (const row of deps.rows as Array<{ id: number; entity_key: string; entity_type: string; summary: string }>) {
				if (visited.has(row.id)) continue;
				visited.add(row.id);

				const path = [...current.path, row.entity_key];
				affected.push({
					entityKey: row.entity_key,
					entityType: row.entity_type,
					distance: current.dist + 1,
					path,
				});

				queue.push({ entityId: row.id, dist: current.dist + 1, path });
			}
		}

		return {
			root: { key: root.entity_key, type: root.entity_type, summary: root.summary ?? '' },
			affected,
			totalAffected: affected.length,
		};
	}

	/**
	 * dependency_graph — §5.5 의존 그래프 서브트리
	 */
	async dependencyGraph(params: {
		entityKey: string;
		direction?: 'upstream' | 'downstream' | 'both';
		depth?: number;
	}): Promise<DependencyGraphResult> {
		const direction = params.direction ?? 'both';
		const maxDepth = params.depth ?? 3;

		const rootResult = await this.db.execute(sql`
			SELECT e.id, e.entity_key, et.name as entity_type, e.summary
			FROM entity e
			JOIN entity_type et ON et.id = e.entity_type_id
			WHERE e.workspace_id = ${this.workspaceId} AND e.entity_key = ${params.entityKey}
			LIMIT 1
		`);

		if (rootResult.rows.length === 0) {
			return { nodes: [], edges: [] };
		}

		const root = rootResult.rows[0] as { id: number; entity_key: string; entity_type: string; summary: string };
		const nodes = new Map<string, { entityKey: string; entityType: string; summary: string }>();
		const edges: DependencyGraphResult['edges'] = [];
		const visited = new Set<number>([root.id]);

		nodes.set(root.entity_key, { entityKey: root.entity_key, entityType: root.entity_type, summary: root.summary ?? '' });

		const queue: Array<{ entityId: number; entityKey: string; dist: number }> = [
			{ entityId: root.id, entityKey: root.entity_key, dist: 0 },
		];

		while (queue.length > 0) {
			const current = queue.shift()!;
			if (current.dist >= maxDepth) continue;

			// Downstream: current depends on others (outgoing)
			if (direction === 'downstream' || direction === 'both') {
				const downstream = await this.db.execute(sql`
					SELECT e.id, e.entity_key, et.name as entity_type, e.summary,
						   rt.name as relation_type, st.name as strength
					FROM relation r
					JOIN entity e ON e.id = r.dst_entity_id
					JOIN entity_type et ON et.id = e.entity_type_id
					JOIN relation_type rt ON rt.id = r.relation_type_id
					JOIN strength_type st ON st.id = r.strength_type_id
					WHERE r.src_entity_id = ${current.entityId} AND e.is_deleted = false
				`);

				for (const row of downstream.rows as Array<{
					id: number; entity_key: string; entity_type: string; summary: string;
					relation_type: string; strength: string;
				}>) {
					nodes.set(row.entity_key, { entityKey: row.entity_key, entityType: row.entity_type, summary: row.summary ?? '' });
					edges.push({ src: current.entityKey, dst: row.entity_key, relationType: row.relation_type, strength: row.strength });

					if (!visited.has(row.id)) {
						visited.add(row.id);
						queue.push({ entityId: row.id, entityKey: row.entity_key, dist: current.dist + 1 });
					}
				}
			}

			// Upstream: others depend on current (incoming)
			if (direction === 'upstream' || direction === 'both') {
				const upstream = await this.db.execute(sql`
					SELECT e.id, e.entity_key, et.name as entity_type, e.summary,
						   rt.name as relation_type, st.name as strength
					FROM relation r
					JOIN entity e ON e.id = r.src_entity_id
					JOIN entity_type et ON et.id = e.entity_type_id
					JOIN relation_type rt ON rt.id = r.relation_type_id
					JOIN strength_type st ON st.id = r.strength_type_id
					WHERE r.dst_entity_id = ${current.entityId} AND e.is_deleted = false
				`);

				for (const row of upstream.rows as Array<{
					id: number; entity_key: string; entity_type: string; summary: string;
					relation_type: string; strength: string;
				}>) {
					nodes.set(row.entity_key, { entityKey: row.entity_key, entityType: row.entity_type, summary: row.summary ?? '' });
					edges.push({ src: row.entity_key, dst: current.entityKey, relationType: row.relation_type, strength: row.strength });

					if (!visited.has(row.id)) {
						visited.add(row.id);
						queue.push({ entityId: row.id, entityKey: row.entity_key, dist: current.dist + 1 });
					}
				}
			}
		}

		return { nodes: Array.from(nodes.values()), edges };
	}

	/**
	 * trace_chain — §5.5 최단 관계 경로 (BFS)
	 */
	async traceChain(fromKey: string, toKey: string): Promise<TraceChainResult> {
		const fromResult = await this.db.execute(sql`
			SELECT id, entity_key, et.name as entity_type FROM entity e
			JOIN entity_type et ON et.id = e.entity_type_id
			WHERE e.workspace_id = ${this.workspaceId} AND e.entity_key = ${fromKey} LIMIT 1
		`);
		const toResult = await this.db.execute(sql`
			SELECT id, entity_key FROM entity
			WHERE workspace_id = ${this.workspaceId} AND entity_key = ${toKey} LIMIT 1
		`);

		if (fromResult.rows.length === 0 || toResult.rows.length === 0) {
			return { found: false, path: [], relations: [] };
		}

		const fromEntity = fromResult.rows[0] as { id: number; entity_key: string; entity_type: string };
		const toId = (toResult.rows[0] as { id: number }).id;

		// BFS
		const visited = new Map<number, { parentId: number | null; entityKey: string; entityType: string; relationType: string | null }>();
		visited.set(fromEntity.id, { parentId: null, entityKey: fromEntity.entity_key, entityType: fromEntity.entity_type, relationType: null });

		const queue: number[] = [fromEntity.id];
		let found = false;

		while (queue.length > 0 && !found) {
			const current = queue.shift()!;

			// Both directions
			const neighbors = await this.db.execute(sql`
				SELECT e.id, e.entity_key, et.name as entity_type, rt.name as relation_type, 'out' as dir
				FROM relation r
				JOIN entity e ON e.id = r.dst_entity_id
				JOIN entity_type et ON et.id = e.entity_type_id
				JOIN relation_type rt ON rt.id = r.relation_type_id
				WHERE r.src_entity_id = ${current} AND e.is_deleted = false
				UNION ALL
				SELECT e.id, e.entity_key, et.name as entity_type, rt.name as relation_type, 'in' as dir
				FROM relation r
				JOIN entity e ON e.id = r.src_entity_id
				JOIN entity_type et ON et.id = e.entity_type_id
				JOIN relation_type rt ON rt.id = r.relation_type_id
				WHERE r.dst_entity_id = ${current} AND e.is_deleted = false
			`);

			for (const row of neighbors.rows as Array<{ id: number; entity_key: string; entity_type: string; relation_type: string }>) {
				if (visited.has(row.id)) continue;
				visited.set(row.id, { parentId: current, entityKey: row.entity_key, entityType: row.entity_type, relationType: row.relation_type });
				queue.push(row.id);

				if (row.id === toId) {
					found = true;
					break;
				}
			}
		}

		if (!found) {
			return { found: false, path: [], relations: [] };
		}

		// Reconstruct path
		const path: { entityKey: string; entityType: string }[] = [];
		const relations: { src: string; dst: string; relationType: string }[] = [];
		type VisitInfo = { parentId: number | null; entityKey: string; entityType: string; relationType: string | null };
		let currentId: number | null = toId;

		while (currentId !== null) {
			const info: VisitInfo = visited.get(currentId)!;
			path.unshift({ entityKey: info.entityKey, entityType: info.entityType });
			if (info.parentId !== null && info.relationType) {
				const parentInfo = visited.get(info.parentId)!;
				relations.unshift({ src: parentInfo.entityKey, dst: info.entityKey, relationType: info.relationType });
			}
			currentId = info.parentId;
		}

		return { found: true, path, relations };
	}

	/**
	 * coverage_map — §5.5 spec → code → test 커버리지
	 */
	async coverageMap(specKey: string): Promise<CoverageMapResult> {
		const specResult = await this.db.execute(sql`
			SELECT e.id, e.entity_key, e.summary
			FROM entity e
			JOIN entity_type et ON et.id = e.entity_type_id
			WHERE e.workspace_id = ${this.workspaceId}
			  AND e.entity_key = ${specKey}
			  AND et.name = 'spec'
			LIMIT 1
		`);

		if (specResult.rows.length === 0) {
			return { spec: { key: specKey, summary: '' }, implementations: [], tests: [], gaps: [] };
		}

		const spec = specResult.rows[0] as { id: number; entity_key: string; summary: string };
		const gaps: CoverageMapResult['gaps'] = [];

		// Implementations: entities that implement this spec
		const implResult = await this.db.execute(sql`
			SELECT e.entity_key, rt.name as relation_type, st.name as strength
			FROM relation r
			JOIN entity e ON e.id = r.src_entity_id
			JOIN relation_type rt ON rt.id = r.relation_type_id
			JOIN strength_type st ON st.id = r.strength_type_id
			WHERE r.dst_entity_id = ${spec.id}
			  AND rt.name = 'implements'
			  AND e.is_deleted = false
		`);

		const implementations = (implResult.rows as Array<{
			entity_key: string; relation_type: string; strength: string;
		}>).map((r) => ({
			entityKey: r.entity_key,
			relationType: r.relation_type,
			strength: r.strength,
		}));

		if (implementations.length === 0) {
			gaps.push({ type: 'no_implementation', entityKey: spec.entity_key, summary: spec.summary ?? '' });
		}

		// Tests: entities that test the implementations
		const tests: CoverageMapResult['tests'] = [];
		for (const impl of implementations) {
			const testResult = await this.db.execute(sql`
				SELECT e.entity_key, rt.name as relation_type
				FROM relation r
				JOIN entity e ON e.id = r.src_entity_id
				JOIN relation_type rt ON rt.id = r.relation_type_id
				WHERE r.dst_entity_id = (
					SELECT id FROM entity
					WHERE workspace_id = ${this.workspaceId} AND entity_key = ${impl.entityKey} LIMIT 1
				)
				AND rt.name = 'tests'
				AND e.is_deleted = false
			`);

			if (testResult.rows.length === 0) {
				gaps.push({ type: 'no_test', entityKey: impl.entityKey, summary: `No tests for ${impl.entityKey}` });
			}

			for (const row of testResult.rows as Array<{ entity_key: string; relation_type: string }>) {
				tests.push({
					entityKey: row.entity_key,
					relationType: row.relation_type,
					targetKey: impl.entityKey,
				});
			}
		}

		return {
			spec: { key: spec.entity_key, summary: spec.summary ?? '' },
			implementations,
			tests,
			gaps,
		};
	}

	/**
	 * inconsistency_report — §5.5 불일치/누락 검출
	 */
	async inconsistencyReport(scope?: 'structural' | 'semantic' | 'full'): Promise<InconsistencyItem[]> {
		const level = scope ?? 'full';
		const items: InconsistencyItem[] = [];

		if (level === 'structural' || level === 'full') {
			// Dangling relations
			const dangling = await this.db.execute(sql`
				SELECT r.id, se.entity_key as src_key, de.entity_key as dst_key
				FROM relation r
				JOIN entity se ON se.id = r.src_entity_id
				JOIN entity de ON de.id = r.dst_entity_id
				WHERE (se.is_deleted = true OR de.is_deleted = true)
				  AND se.workspace_id = ${this.workspaceId}
			`);

			for (const row of dangling.rows as Array<{ src_key: string; dst_key: string }>) {
				items.push({
					type: 'dangling_relation',
					entityKey: row.src_key,
					summary: `Dangling relation: ${row.src_key} → ${row.dst_key} (one side is tombstoned)`,
				});
			}

			// Evidence-less relations
			const noEvidence = await this.db.execute(sql`
				SELECT r.id, se.entity_key as src_key, de.entity_key as dst_key
				FROM relation r
				JOIN entity se ON se.id = r.src_entity_id
				JOIN entity de ON de.id = r.dst_entity_id
				LEFT JOIN relation_evidence re ON re.relation_id = r.id
				WHERE re.relation_id IS NULL
				  AND se.workspace_id = ${this.workspaceId}
			`);

			for (const row of noEvidence.rows as Array<{ src_key: string; dst_key: string }>) {
				items.push({
					type: 'evidenceless_relation',
					entityKey: row.src_key,
					summary: `Relation without evidence: ${row.src_key} → ${row.dst_key}`,
				});
			}
		}

		if (level === 'semantic' || level === 'full') {
			// Specs without implementations
			const specsNoImpl = await this.db.execute(sql`
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

			for (const row of specsNoImpl.rows as Array<{ entity_key: string; summary: string }>) {
				items.push({
					type: 'spec_no_impl',
					entityKey: row.entity_key,
					summary: `Spec without implementation: ${row.entity_key}`,
				});
			}

			// Code without tests
			const codeNoTest = await this.db.execute(sql`
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

			for (const row of codeNoTest.rows as Array<{ entity_key: string; summary: string }>) {
				items.push({
					type: 'code_no_test',
					entityKey: row.entity_key,
					summary: `Code without tests: ${row.entity_key}`,
				});
			}
		}

		return items;
	}

	/**
	 * find_orphans — §5.5 어떤 relation도 없는 고립 entity
	 */
	async findOrphans(entityType?: string): Promise<OrphanItem[]> {
		let typeFilter = sql`true`;
		if (entityType) {
			typeFilter = sql`et.name = ${entityType}`;
		}

		const result = await this.db.execute(sql`
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

		return (result.rows as Array<{ entity_key: string; entity_type: string; summary: string }>).map((r) => ({
			entityKey: r.entity_key,
			entityType: r.entity_type,
			summary: r.summary ?? '',
		}));
	}
}
