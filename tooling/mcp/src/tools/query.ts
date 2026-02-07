/**
 * Query Tools — §6.1 Query (읽기)
 *
 * search, describe, relations, facts, evidence, bulk_describe, bulk_facts
 *
 * @see MCP_PLAN §5, §6.1, §6.5, §6.7
 */

import { sql } from 'drizzle-orm';
import type { Db } from '../db';
import type { ReadThroughValidator } from '../read-through';

// ── Response Types (§6.7) ────────────────────────────────────

export type SearchMatch = {
	entity: { key: string; type: string; summary: string };
	facts: { factKey: string; factType: string; payloadText: string }[];
	score: number;
	stale: boolean;
};

export type SearchResult = {
	matches: SearchMatch[];
	totalMatches: number;
};

export type DescribeResult = {
	entity: {
		key: string; type: string; summary: string;
		meta: Record<string, unknown>; isDeleted: boolean;
	};
	sources: { filePath: string; kind: string; contentHash: string; stale: boolean }[];
	facts: {
		factKey: string; factType: string;
		payloadText: string; payloadJson: Record<string, unknown> | null;
	}[];
	relationSummary: { incoming: number; outgoing: number };
};

export type RelationItem = {
	id: number;
	srcEntity: { key: string; type: string; summary: string };
	dstEntity: { key: string; type: string; summary: string };
	relationType: string;
	strength: string;
	meta: Record<string, unknown>;
};

export type FactItem = {
	id: number;
	factKey: string;
	factType: string;
	payloadText: string | null;
	payloadJson: Record<string, unknown>;
};

export type EvidenceItem = {
	factId: number;
	factKey: string;
	factType: string;
	payloadText: string | null;
};

// ── Query Tools ──────────────────────────────────────────────

export class QueryTools {
	constructor(
		private db: Db,
		private validator: ReadThroughValidator,
		private workspaceId: string,
	) {}

	/**
	 * search — §5.1 Lexical search (FTS + ts_rank_cd)
	 */
	async search(params: {
		query: string;
		limit?: number;
		entityType?: string;
		factType?: string;
		includeDeleted?: boolean;
	}): Promise<SearchResult> {
		const limit = params.limit ?? 10;
		const tsQuery = params.query.split(/\s+/).filter(Boolean).join(' & ');

		let whereClause = sql`e.workspace_id = ${this.workspaceId}`;
		if (!params.includeDeleted) {
			whereClause = sql`${whereClause} AND e.is_deleted = false`;
		}
		if (params.entityType) {
			whereClause = sql`${whereClause} AND et.name = ${params.entityType}`;
		}
		if (params.factType) {
			whereClause = sql`${whereClause} AND ft.name = ${params.factType}`;
		}

		const result = await this.db.execute(sql`
			SELECT
				e.entity_key, et.name as entity_type, e.summary as entity_summary,
				f.id as fact_id, f.fact_key, ft.name as fact_type,
				f.payload_text,
				ts_rank_cd(f.payload_tsv, to_tsquery('simple', ${tsQuery})) as rank
			FROM fact f
			JOIN entity e ON e.id = f.entity_id
			JOIN entity_type et ON et.id = e.entity_type_id
			JOIN fact_type ft ON ft.id = f.fact_type_id
			WHERE ${whereClause}
			  AND f.payload_tsv @@ to_tsquery('simple', ${tsQuery})
			ORDER BY rank DESC
			LIMIT ${limit}
		`);

		// group by entity
		const entityMap = new Map<string, SearchMatch>();

		for (const row of result.rows as Array<{
			entity_key: string; entity_type: string; entity_summary: string;
			fact_key: string; fact_type: string; payload_text: string;
			rank: number;
		}>) {
			let entry = entityMap.get(row.entity_key);
			if (!entry) {
				entry = {
					entity: { key: row.entity_key, type: row.entity_type, summary: row.entity_summary ?? '' },
					facts: [],
					score: row.rank,
					stale: false,
				};
				entityMap.set(row.entity_key, entry);
			}
			entry.facts.push({
				factKey: row.fact_key,
				factType: row.fact_type,
				payloadText: row.payload_text ?? '',
			});
			if (row.rank > entry.score) entry.score = row.rank;
		}

		// Read-through validation for sources
		const matches = Array.from(entityMap.values());
		for (const m of matches) {
			const sources = await this.getEntitySources(m.entity.key);
			for (const s of sources) {
				const check = await this.validator.validateSource(s.filePath, s.contentHash);
				if (check.stale) {
					m.stale = true;
					break;
				}
			}
		}

		return { matches, totalMatches: matches.length };
	}

	/**
	 * describe — §6.1 entity + sources + facts 요약
	 */
	async describe(entityKey: string): Promise<DescribeResult | null> {
		const entityResult = await this.db.execute(sql`
			SELECT e.id, e.entity_key, et.name as entity_type, e.summary,
				   e.meta, e.is_deleted
			FROM entity e
			JOIN entity_type et ON et.id = e.entity_type_id
			WHERE e.workspace_id = ${this.workspaceId} AND e.entity_key = ${entityKey}
			LIMIT 1
		`);

		if (entityResult.rows.length === 0) return null;
		const entity = entityResult.rows[0] as {
			id: number; entity_key: string; entity_type: string;
			summary: string; meta: Record<string, unknown>; is_deleted: boolean;
		};

		// Sources + read-through validation
		const sourcesResult = await this.db.execute(sql`
			SELECT s.file_path, s.kind, s.content_hash
			FROM source s
			WHERE s.entity_id = ${entity.id}
		`);

		const sources: DescribeResult['sources'] = [];
		for (const s of sourcesResult.rows as Array<{ file_path: string; kind: string; content_hash: string }>) {
			const check = await this.validator.validateSource(s.file_path, s.content_hash);
			sources.push({
				filePath: s.file_path,
				kind: s.kind,
				contentHash: s.content_hash,
				stale: check.stale,
			});
		}

		// Facts
		const factsResult = await this.db.execute(sql`
			SELECT f.fact_key, ft.name as fact_type, f.payload_text, f.payload_json
			FROM fact f
			JOIN fact_type ft ON ft.id = f.fact_type_id
			WHERE f.entity_id = ${entity.id}
		`);

		const facts = (factsResult.rows as Array<{
			fact_key: string; fact_type: string;
			payload_text: string | null; payload_json: Record<string, unknown>;
		}>).map((f) => ({
			factKey: f.fact_key,
			factType: f.fact_type,
			payloadText: f.payload_text ?? '',
			payloadJson: f.payload_json ?? null,
		}));

		// Relation summary
		const incoming = await this.db.execute(sql`
			SELECT COUNT(*) as cnt FROM relation WHERE dst_entity_id = ${entity.id}
		`);
		const outgoing = await this.db.execute(sql`
			SELECT COUNT(*) as cnt FROM relation WHERE src_entity_id = ${entity.id}
		`);

		return {
			entity: {
				key: entity.entity_key,
				type: entity.entity_type,
				summary: entity.summary ?? '',
				meta: entity.meta ?? {},
				isDeleted: entity.is_deleted,
			},
			sources,
			facts,
			relationSummary: {
				incoming: Number((incoming.rows[0] as { cnt: unknown })?.cnt ?? 0),
				outgoing: Number((outgoing.rows[0] as { cnt: unknown })?.cnt ?? 0),
			},
		};
	}

	/**
	 * relations — §6.1 관계 탐색 (multi-hop 지원)
	 */
	async relations(params: {
		entityKey: string;
		direction?: 'incoming' | 'outgoing' | 'both';
		relationType?: string;
		depth?: number;
		limit?: number;
	}): Promise<RelationItem[]> {
		const direction = params.direction ?? 'both';
		const limit = params.limit ?? 50;

		// Get entity id
		const entityId = await this.resolveEntityId(params.entityKey);
		if (!entityId) return [];

		const results: RelationItem[] = [];
		const visited = new Set<number>([entityId]);
		const maxDepth = params.depth ?? 1;

		await this.walkRelations(entityId, direction, params.relationType, maxDepth, 0, visited, results, limit);

		return results.slice(0, limit);
	}

	private async walkRelations(
		entityId: number,
		direction: 'incoming' | 'outgoing' | 'both',
		relationType: string | undefined,
		maxDepth: number,
		currentDepth: number,
		visited: Set<number>,
		results: RelationItem[],
		limit: number,
	): Promise<void> {
		if (currentDepth >= maxDepth || results.length >= limit) return;

		let whereClause = sql`true`;
		if (relationType) {
			whereClause = sql`${whereClause} AND rt.name = ${relationType}`;
		}

		const queries: Array<ReturnType<typeof this.db.execute>> = [];

		if (direction === 'outgoing' || direction === 'both') {
			queries.push(this.db.execute(sql`
				SELECT r.id, r.meta,
					   se.entity_key as src_key, set2.name as src_type, se.summary as src_summary,
					   de.entity_key as dst_key, det.name as dst_type, de.summary as dst_summary,
					   rt.name as relation_type, st.name as strength,
					   de.id as neighbor_id
				FROM relation r
				JOIN entity se ON se.id = r.src_entity_id
				JOIN entity_type set2 ON set2.id = se.entity_type_id
				JOIN entity de ON de.id = r.dst_entity_id
				JOIN entity_type det ON det.id = de.entity_type_id
				JOIN relation_type rt ON rt.id = r.relation_type_id
				JOIN strength_type st ON st.id = r.strength_type_id
				WHERE r.src_entity_id = ${entityId} AND ${whereClause}
				LIMIT ${limit}
			`));
		}

		if (direction === 'incoming' || direction === 'both') {
			queries.push(this.db.execute(sql`
				SELECT r.id, r.meta,
					   se.entity_key as src_key, set2.name as src_type, se.summary as src_summary,
					   de.entity_key as dst_key, det.name as dst_type, de.summary as dst_summary,
					   rt.name as relation_type, st.name as strength,
					   se.id as neighbor_id
				FROM relation r
				JOIN entity se ON se.id = r.src_entity_id
				JOIN entity_type set2 ON set2.id = se.entity_type_id
				JOIN entity de ON de.id = r.dst_entity_id
				JOIN entity_type det ON det.id = de.entity_type_id
				JOIN relation_type rt ON rt.id = r.relation_type_id
				JOIN strength_type st ON st.id = r.strength_type_id
				WHERE r.dst_entity_id = ${entityId} AND ${whereClause}
				LIMIT ${limit}
			`));
		}

		const queryResults = await Promise.all(queries);
		const neighborIds: number[] = [];

		for (const qr of queryResults) {
			for (const row of qr.rows as Array<{
				id: number; meta: Record<string, unknown>;
				src_key: string; src_type: string; src_summary: string;
				dst_key: string; dst_type: string; dst_summary: string;
				relation_type: string; strength: string;
				neighbor_id: number;
			}>) {
				results.push({
					id: row.id,
					srcEntity: { key: row.src_key, type: row.src_type, summary: row.src_summary ?? '' },
					dstEntity: { key: row.dst_key, type: row.dst_type, summary: row.dst_summary ?? '' },
					relationType: row.relation_type,
					strength: row.strength,
					meta: row.meta ?? {},
				});

				if (!visited.has(row.neighbor_id)) {
					visited.add(row.neighbor_id);
					neighborIds.push(row.neighbor_id);
				}
			}
		}

		// Multi-hop
		for (const neighborId of neighborIds) {
			await this.walkRelations(neighborId, direction, relationType, maxDepth, currentDepth + 1, visited, results, limit);
		}
	}

	/**
	 * facts — §6.1 entity의 fact 목록
	 */
	async facts(params: {
		entityKey: string;
		factType?: string;
		limit?: number;
	}): Promise<FactItem[]> {
		const entityId = await this.resolveEntityId(params.entityKey);
		if (!entityId) return [];

		const limit = params.limit ?? 100;

		let whereClause = sql`f.entity_id = ${entityId}`;
		if (params.factType) {
			whereClause = sql`${whereClause} AND ft.name = ${params.factType}`;
		}

		const result = await this.db.execute(sql`
			SELECT f.id, f.fact_key, ft.name as fact_type, f.payload_text, f.payload_json
			FROM fact f
			JOIN fact_type ft ON ft.id = f.fact_type_id
			WHERE ${whereClause}
			LIMIT ${limit}
		`);

		return (result.rows as Array<{
			id: number; fact_key: string; fact_type: string;
			payload_text: string | null; payload_json: Record<string, unknown>;
		}>).map((r) => ({
			id: r.id,
			factKey: r.fact_key,
			factType: r.fact_type,
			payloadText: r.payload_text,
			payloadJson: r.payload_json ?? {},
		}));
	}

	/**
	 * evidence — §6.1 relation의 evidence fact 목록
	 */
	async evidence(relationId: number): Promise<EvidenceItem[]> {
		const result = await this.db.execute(sql`
			SELECT f.id as fact_id, f.fact_key, ft.name as fact_type, f.payload_text
			FROM relation_evidence re
			JOIN fact f ON f.id = re.fact_id
			JOIN fact_type ft ON ft.id = f.fact_type_id
			WHERE re.relation_id = ${relationId}
		`);

		return (result.rows as Array<{
			fact_id: number; fact_key: string; fact_type: string; payload_text: string | null;
		}>).map((r) => ({
			factId: r.fact_id,
			factKey: r.fact_key,
			factType: r.fact_type,
			payloadText: r.payload_text,
		}));
	}

	/**
	 * bulk_describe — §6.5
	 */
	async bulkDescribe(entityKeys: string[]): Promise<Map<string, DescribeResult>> {
		const results = new Map<string, DescribeResult>();
		for (const key of entityKeys) {
			const desc = await this.describe(key);
			if (desc) results.set(key, desc);
		}
		return results;
	}

	/**
	 * bulk_facts — §6.5
	 */
	async bulkFacts(entityKeys: string[], factType?: string): Promise<Map<string, FactItem[]>> {
		const results = new Map<string, FactItem[]>();
		for (const key of entityKeys) {
			const fParams: Parameters<typeof this.facts>[0] = { entityKey: key };
			if (factType) fParams.factType = factType;
			const f = await this.facts(fParams);
			results.set(key, f);
		}
		return results;
	}

	// ── Helpers ──────────────────────────────────────────────

	private async resolveEntityId(entityKey: string): Promise<number | undefined> {
		const result = await this.db.execute(sql`
			SELECT id FROM entity
			WHERE workspace_id = ${this.workspaceId} AND entity_key = ${entityKey}
			LIMIT 1
		`);
		const row = result.rows[0] as { id?: number } | undefined;
		return row?.id;
	}

	private async getEntitySources(entityKey: string): Promise<Array<{ filePath: string; contentHash: string }>> {
		const result = await this.db.execute(sql`
			SELECT s.file_path, s.content_hash
			FROM source s
			JOIN entity e ON e.id = s.entity_id
			WHERE e.workspace_id = ${this.workspaceId} AND e.entity_key = ${entityKey}
		`);
		return (result.rows as Array<{ file_path: string; content_hash: string }>).map((r) => ({
			filePath: r.file_path,
			contentHash: r.content_hash,
		}));
	}
}
