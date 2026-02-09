/**
 * Query Tools — §6.1 Query (읽기)
 *
 * search, describe, relations, facts, evidence, bulk_describe, bulk_facts
 *
 * @see MCP_PLAN §5, §6.1, §6.5, §6.7
 */

import type { Db } from '../db';
import { createRepos } from '../repo';
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

	private static sourcePairKey(filePath: string, contentHash: string) {
		return `${filePath}\0${contentHash}`;
	}

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
		const rawQuery = typeof params.query === 'string' ? params.query.trim() : '';
		if (rawQuery.length === 0) {
			return { matches: [], totalMatches: 0 };
		}

		const data = await this.db.transaction(async (tx) => {
			const repos = createRepos(tx);
			const limit = params.limit ?? 10;

			const includeDeleted = params.includeDeleted ?? false;
			const entityTypeId = params.entityType
				? await repos.types.getEntityTypeIdByName(params.entityType)
				: null;
			if (params.entityType && entityTypeId == null) {
				return { matches: [], totalMatches: 0, entitySources: [] };
			}
			const factTypeId = params.factType
				? await repos.types.getFactTypeIdByName(params.factType)
				: null;
			if (params.factType && factTypeId == null) {
				return { matches: [], totalMatches: 0, entitySources: [] };
			}

			const rows = await repos.fact.searchFacts({
				workspaceId: this.workspaceId,
				query: rawQuery,
				limit,
				...(entityTypeId != null ? { entityTypeId } : {}),
				...(factTypeId != null ? { factTypeId } : {}),
				includeDeleted,
			});

			// group by entity
			type InterimMatch = {
				entityKey: string;
				entityTypeId: number;
				entitySummary: string | null;
				facts: { factKey: string; factTypeId: number; payloadText: string | null }[];
				score: number;
				stale: boolean;
			};
			const entityMap = new Map<string, InterimMatch>();
			for (const row of rows) {
				let entry = entityMap.get(row.entityKey);
				if (!entry) {
					entry = {
						entityKey: row.entityKey,
						entityTypeId: row.entityTypeId,
						entitySummary: row.entitySummary,
						facts: [],
						score: row.rank,
						stale: false,
					};
					entityMap.set(row.entityKey, entry);
				}
				entry.facts.push({
					factKey: row.factKey,
					factTypeId: row.factTypeId,
					payloadText: row.payloadText,
				});
				if (row.rank > entry.score) entry.score = row.rank;
			}

			const interimMatches = Array.from(entityMap.values());
			if (interimMatches.length === 0) return { matches: [], totalMatches: 0, entitySources: [] };

			const entityTypeIds = Array.from(new Set(interimMatches.map((m) => m.entityTypeId)));
			const factTypeIds = Array.from(
				new Set(interimMatches.flatMap((m) => m.facts.map((f) => f.factTypeId))),
			);
			const entityTypeNames = await repos.types.getEntityTypeNamesByIds(entityTypeIds);
			const factTypeNames = await repos.types.getFactTypeNamesByIds(factTypeIds);

			const matches: SearchMatch[] = interimMatches.map((m) => ({
				entity: {
					key: m.entityKey,
					type: entityTypeNames.get(m.entityTypeId) ?? '',
					summary: m.entitySummary ?? '',
				},
				facts: m.facts.map((f) => ({
					factKey: f.factKey,
					factType: factTypeNames.get(f.factTypeId) ?? '',
					payloadText: f.payloadText ?? '',
				})),
				score: m.score,
				stale: m.stale,
			}));

			// Read-through validation은 트랜잭션 밖에서 수행한다.
			let entitySources: Array<{ entityKey: string; filePath: string; contentHash: string }> = [];
			if (matches.length > 0) {
				const entities = await repos.entity.findIdsByKeys({
					workspaceId: this.workspaceId,
					entityKeys: matches.map((m) => m.entity.key),
					includeDeleted: true,
				});
				const idByKey = new Map<string, number>();
				for (const e of entities) idByKey.set(e.entityKey, e.id);
				const keyById = new Map<number, string>();
				for (const e of entities) keyById.set(e.id, e.entityKey);
				const sources = await repos.source.listByEntityIds({ entityIds: entities.map((e) => e.id) });
				entitySources = sources.map((s) => ({
					entityKey: keyById.get(s.entityId) ?? '',
					filePath: s.filePath,
					contentHash: s.contentHash,
				})).filter((s) => s.entityKey.length > 0);
				// idByKey는 이후 stale 플래그 적용 시 정확도를 위해 유지
				void idByKey;
			}

			return { matches, totalMatches: matches.length, entitySources };
		});

		if (data.matches.length === 0 || data.entitySources.length === 0) {
			return { matches: data.matches, totalMatches: data.totalMatches };
		}

		const checks = await this.validator.validateSourcePairs(
			data.entitySources.map((s) => ({ filePath: s.filePath, contentHash: s.contentHash })),
			{ concurrency: 16 },
		);
		const sourcesByEntityKey = new Map<string, Array<{ filePath: string; contentHash: string }>>();
		for (const s of data.entitySources) {
			const list = sourcesByEntityKey.get(s.entityKey) ?? [];
			list.push({ filePath: s.filePath, contentHash: s.contentHash });
			sourcesByEntityKey.set(s.entityKey, list);
		}

		for (const m of data.matches) {
			const entitySources = sourcesByEntityKey.get(m.entity.key) ?? [];
			for (const s of entitySources) {
				const check = checks.get(QueryTools.sourcePairKey(s.filePath, s.contentHash));
				if (check?.stale) {
					m.stale = true;
					break;
				}
			}
		}

		return { matches: data.matches, totalMatches: data.totalMatches };
	}

	/**
	 * describe — §6.1 entity + sources + facts 요약
	 */
	async describe(entityKey: string): Promise<DescribeResult | null> {
		const data = await this.db.transaction(async (tx) => {
			const repos = createRepos(tx);
			const entity = await repos.entity.findByWorkspaceKey({ workspaceId: this.workspaceId, entityKey });
			if (!entity) return null;
			const entityType = (await repos.types.getEntityTypeNameById(entity.entityTypeId)) ?? '';

			const sourcesRows = await repos.source.listByEntityId({ entityId: entity.id });
			const factsRows = await repos.fact.listByEntityId({ entityId: entity.id });
			const counts = await repos.relation.countIncomingOutgoing({ entityId: entity.id });

			// Facts
			const factTypeIds = Array.from(new Set(factsRows.map((f) => f.factTypeId)));
			const factTypeNames = await repos.types.getFactTypeNamesByIds(factTypeIds);
			const facts = factsRows.map((f) => ({
				factKey: f.factKey,
				factType: factTypeNames.get(f.factTypeId) ?? '',
				payloadText: f.payloadText ?? '',
				payloadJson: f.payloadJson ?? null,
			}));

			return {
				entity: {
					key: entity.entityKey,
					type: entityType,
					summary: entity.summary ?? '',
					meta: entity.meta ?? {},
					isDeleted: entity.isDeleted,
				},
				sourcesRows,
				facts,
				counts,
			};
		});

		if (!data) return null;

		const checks = await this.validator.validateSourcePairs(
			data.sourcesRows.map((s) => ({ filePath: s.filePath, contentHash: s.contentHash })),
			{ concurrency: 16 },
		);

		const sources: DescribeResult['sources'] = data.sourcesRows.map((s) => {
			const check = checks.get(QueryTools.sourcePairKey(s.filePath, s.contentHash));
			return {
				filePath: s.filePath,
				kind: s.kind,
				contentHash: s.contentHash,
				stale: check?.stale ?? false,
			};
		});

		return {
			entity: data.entity,
			sources,
			facts: data.facts,
			relationSummary: {
				incoming: data.counts.incoming,
				outgoing: data.counts.outgoing,
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
		return this.db.transaction(async (tx) => {
			const repos = createRepos(tx);
			const direction = params.direction ?? 'both';
			const limit = params.limit ?? 50;
			const relationTypeId = params.relationType
				? await repos.types.getRelationTypeIdByName(params.relationType)
				: null;
			if (params.relationType && relationTypeId == null) return [];

			// Get entity id
			const entityId = await repos.entity.resolveIdByKey({
				workspaceId: this.workspaceId,
				entityKey: params.entityKey,
				includeDeleted: true,
			});
			if (!entityId) return [];

			type InterimRelation = {
				relationId: number;
				meta: Record<string, unknown>;
				src: { key: string; typeId: number; summary: string | null };
				dst: { key: string; typeId: number; summary: string | null };
				relationTypeId: number;
				strengthTypeId: number;
				neighborId: number;
			};
			const results: InterimRelation[] = [];
			const visited = new Set<number>([entityId]);
			const maxDepth = params.depth ?? 1;

			let frontier: number[] = [entityId];
			let currentDepth = 0;
			while (frontier.length > 0 && currentDepth < maxDepth && results.length < limit) {
				const remaining = limit - results.length;
				const nextFrontier: number[] = [];

				if (direction === 'outgoing' || direction === 'both') {
					const outgoing = await repos.relation.listOutgoingForFrontier({
						srcEntityIds: frontier,
						...(relationTypeId != null ? { relationTypeId } : {}),
						limit: remaining,
					});
					for (const row of outgoing) {
						results.push({
							relationId: row.relationId,
							meta: row.meta,
							src: { key: row.src.key, typeId: row.src.typeId, summary: row.src.summary },
							dst: { key: row.dst.key, typeId: row.dst.typeId, summary: row.dst.summary },
							relationTypeId: row.relationTypeId,
							strengthTypeId: row.strengthTypeId,
							neighborId: row.neighborId,
						});
						if (!visited.has(row.neighborId)) {
							visited.add(row.neighborId);
							nextFrontier.push(row.neighborId);
						}
					}
				}

				if (direction === 'incoming' || direction === 'both') {
					const incoming = await repos.relation.listIncomingForFrontier({
						dstEntityIds: frontier,
						...(relationTypeId != null ? { relationTypeId } : {}),
						limit: remaining,
					});
					for (const row of incoming) {
						results.push({
							relationId: row.relationId,
							meta: row.meta,
							src: { key: row.src.key, typeId: row.src.typeId, summary: row.src.summary },
							dst: { key: row.dst.key, typeId: row.dst.typeId, summary: row.dst.summary },
							relationTypeId: row.relationTypeId,
							strengthTypeId: row.strengthTypeId,
							neighborId: row.neighborId,
						});
						if (!visited.has(row.neighborId)) {
							visited.add(row.neighborId);
							nextFrontier.push(row.neighborId);
						}
					}
				}

				frontier = nextFrontier;
				currentDepth += 1;
			}

			const entityTypeIds = Array.from(
				new Set(results.flatMap((r) => [r.src.typeId, r.dst.typeId])),
			);
			const relationTypeIds = Array.from(new Set(results.map((r) => r.relationTypeId)));
			const strengthTypeIds = Array.from(new Set(results.map((r) => r.strengthTypeId)));
			const entityTypeNames = await repos.types.getEntityTypeNamesByIds(entityTypeIds);
			const relationTypeNames = await repos.types.getRelationTypeNamesByIds(relationTypeIds);
			const strengthTypeNames = await repos.types.getStrengthTypeNamesByIds(strengthTypeIds);

			return results.slice(0, limit).map((r) => ({
				id: r.relationId,
				srcEntity: {
					key: r.src.key,
					type: entityTypeNames.get(r.src.typeId) ?? '',
					summary: r.src.summary ?? '',
				},
				dstEntity: {
					key: r.dst.key,
					type: entityTypeNames.get(r.dst.typeId) ?? '',
					summary: r.dst.summary ?? '',
				},
				relationType: relationTypeNames.get(r.relationTypeId) ?? '',
				strength: strengthTypeNames.get(r.strengthTypeId) ?? '',
				meta: r.meta ?? {},
			}));
		});
	}

	/**
	 * facts — §6.1 entity fact 목록
	 */
	async facts(params: {
		entityKey: string;
		factType?: string;
		limit?: number;
	}): Promise<FactItem[]> {
		return this.db.transaction(async (tx) => {
			const repos = createRepos(tx);
			const entityId = await repos.entity.resolveIdByKey({
				workspaceId: this.workspaceId,
				entityKey: params.entityKey,
				includeDeleted: true,
			});
			if (!entityId) return [];

			const limit = params.limit ?? 100;
			const factTypeId = params.factType
				? await repos.types.getFactTypeIdByName(params.factType)
				: null;
			if (params.factType && factTypeId == null) return [];

			const rows = await repos.fact.listByEntityIdFiltered({
				entityId,
				...(factTypeId != null ? { factTypeId } : {}),
				limit,
			});
			const factTypeIds = Array.from(new Set(rows.map((r) => r.factTypeId)));
			const factTypeNames = await repos.types.getFactTypeNamesByIds(factTypeIds);
			return rows.map((r) => ({
				id: r.id,
				factKey: r.factKey,
				factType: factTypeNames.get(r.factTypeId) ?? '',
				payloadText: r.payloadText,
				payloadJson: r.payloadJson ?? {},
			}));
		});
	}

	/**
	 * evidence — §6.1 relation의 evidence fact 목록
	 */
	async evidence(relationId: number): Promise<EvidenceItem[]> {
		return this.db.transaction(async (tx) => {
			const repos = createRepos(tx);
			const rows = await repos.relationEvidence.listEvidenceFacts({ relationId });
			const factTypeIds = Array.from(new Set(rows.map((r) => r.factTypeId)));
			const factTypeNames = await repos.types.getFactTypeNamesByIds(factTypeIds);
			return rows.map((r) => ({
				factId: r.factId,
				factKey: r.factKey,
				factType: factTypeNames.get(r.factTypeId) ?? '',
				payloadText: r.payloadText,
			}));
		});
	}

	/**
	 * bulk_describe — §6.5 (병렬 조회)
	 */
	async bulkDescribe(entityKeys: string[]): Promise<Map<string, DescribeResult>> {
		const uniqueKeys = Array.from(new Set(entityKeys)).filter(Boolean);
		if (uniqueKeys.length === 0) return new Map();

		const data = await this.db.transaction(async (tx) => {
			const repos = createRepos(tx);
			const entities = await repos.entity.findByKeys({
				workspaceId: this.workspaceId,
				entityKeys: uniqueKeys,
				includeDeleted: true,
			});
			if (entities.length === 0) return new Map();

			const entityIds = entities.map((e) => e.id);
			const sourcesRows = await repos.source.listByEntityIds({ entityIds });
			const factsRows = await repos.fact.listByEntityIds({ entityIds });
			const countsById = await repos.relation.countIncomingOutgoingByEntityIds({ entityIds });

			const entityTypeIds = Array.from(new Set(entities.map((e) => e.entityTypeId)));
			const factTypeIds = Array.from(new Set(factsRows.map((f) => f.factTypeId)));
			const entityTypeNames = await repos.types.getEntityTypeNamesByIds(entityTypeIds);
			const factTypeNames = await repos.types.getFactTypeNamesByIds(factTypeIds);

			const factsByEntityId = new Map<number, DescribeResult['facts']>();
			for (const f of factsRows) {
				const list = factsByEntityId.get(f.entityId) ?? [];
				list.push({
					factKey: f.factKey,
					factType: factTypeNames.get(f.factTypeId) ?? '',
					payloadText: f.payloadText ?? '',
					payloadJson: f.payloadJson ?? null,
				});
				factsByEntityId.set(f.entityId, list);
			}

			return {
				entities,
				sourcesRows,
				factsByEntityId,
				countsById,
				entityTypeNames,
			};
		});

		if (data instanceof Map) return data;

		const checks = await this.validator.validateSourcePairs(
			data.sourcesRows.map((s) => ({ filePath: s.filePath, contentHash: s.contentHash })),
			{ concurrency: 16 },
		);

		const sourcesByEntityId = new Map<number, Array<{ filePath: string; kind: string; contentHash: string; stale: boolean }>>();
		for (const s of data.sourcesRows) {
			const key = QueryTools.sourcePairKey(s.filePath, s.contentHash);
			const check = checks.get(key);
			const list = sourcesByEntityId.get(s.entityId) ?? [];
			list.push({ filePath: s.filePath, kind: s.kind, contentHash: s.contentHash, stale: check?.stale ?? false });
			sourcesByEntityId.set(s.entityId, list);
		}

		const results = new Map<string, DescribeResult>();
		for (const e of data.entities) {
			const counts = data.countsById.get(e.id) ?? { incoming: 0, outgoing: 0 };
			results.set(e.entityKey, {
				entity: {
					key: e.entityKey,
					type: data.entityTypeNames.get(e.entityTypeId) ?? '',
					summary: e.summary ?? '',
					meta: e.meta ?? {},
					isDeleted: e.isDeleted,
				},
				sources: sourcesByEntityId.get(e.id) ?? [],
				facts: data.factsByEntityId.get(e.id) ?? [],
				relationSummary: {
					incoming: counts.incoming,
					outgoing: counts.outgoing,
				},
			});
		}

		return results;
	}

	/**
	 * bulk_facts — §6.5 (병렬 조회)
	 */
	async bulkFacts(entityKeys: string[], factType?: string): Promise<Map<string, FactItem[]>> {
		const uniqueKeys = Array.from(new Set(entityKeys)).filter(Boolean);
		if (uniqueKeys.length === 0) return new Map();

		return this.db.transaction(async (tx) => {
			const repos = createRepos(tx);
			const entities = await repos.entity.findIdsByKeys({
				workspaceId: this.workspaceId,
				entityKeys: uniqueKeys,
				includeDeleted: true,
			});
			if (entities.length === 0) return new Map();

			const factTypeId = factType ? await repos.types.getFactTypeIdByName(factType) : null;
			const factRows = factType && factTypeId == null
				? []
				: await repos.fact.listByEntityIdsFiltered({
					entityIds: entities.map((e) => e.id),
					...(factTypeId != null ? { factTypeId } : {}),
				});
			const factTypeIds = Array.from(new Set(factRows.map((r) => r.factTypeId)));
			const factTypeNames = await repos.types.getFactTypeNamesByIds(factTypeIds);

			const factsByEntityId = new Map<number, FactItem[]>();
			for (const r of factRows) {
				const list = factsByEntityId.get(r.entityId) ?? [];
				list.push({
					id: r.id,
					factKey: r.factKey,
					factType: factTypeNames.get(r.factTypeId) ?? '',
					payloadText: r.payloadText,
					payloadJson: r.payloadJson ?? {},
				});
				factsByEntityId.set(r.entityId, list);
			}

			const results = new Map<string, FactItem[]>();
			for (const e of entities) {
				results.set(e.entityKey, factsByEntityId.get(e.id) ?? []);
			}
			return results;
		});
	}
}
