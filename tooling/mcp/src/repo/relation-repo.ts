import { and, eq, inArray, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import * as schema from '../../drizzle/schema';
import type { RepoContext, Id } from './_shared';
import { coerceId } from './_shared';
import type { TypeRepo } from './type-repo';

export type RelationRepo = {
	upsert: (input: {
		srcEntityId: Id;
		dstEntityId: Id;
		relationType: string;
		strength: string;
		meta?: Record<string, unknown>;
	}) => Promise<Id>;
	countIncomingOutgoing: (input: { entityId: Id }) => Promise<{ incoming: number; outgoing: number }>;
	countIncomingOutgoingByEntityIds: (input: { entityIds: Id[] }) => Promise<Map<Id, { incoming: number; outgoing: number }>>;
	listByEntityId: (input: { entityId: Id; direction: 'incoming' | 'outgoing' | 'both'; limit: number }) => Promise<
		Array<{
			relationId: Id;
			srcEntityId: Id;
			dstEntityId: Id;
			relationTypeId: number;
			strengthTypeId: number;
			meta: Record<string, unknown>;
		}>
	>;
	listEdgesFrom: (input: { srcEntityIds: Id[] }) => Promise<
		Array<{ viaId: Id; id: Id; entityKey: string; entityTypeId: number; summary: string | null; relationTypeId: number; strengthTypeId: number }>
	>;
	listEdgesTo: (input: { dstEntityIds: Id[] }) => Promise<
		Array<{ viaId: Id; id: Id; entityKey: string; entityTypeId: number; summary: string | null; relationTypeId: number; strengthTypeId: number }>
	>;
	listOutgoingForFrontier: (input: { srcEntityIds: Id[]; relationTypeId?: number; limit: number }) => Promise<
		Array<{
			relationId: Id;
			meta: Record<string, unknown>;
			src: { id: Id; key: string; typeId: number; summary: string | null };
			dst: { id: Id; key: string; typeId: number; summary: string | null };
			relationTypeId: number;
			strengthTypeId: number;
			neighborId: Id;
		}>
	>;
	listIncomingForFrontier: (input: { dstEntityIds: Id[]; relationTypeId?: number; limit: number }) => Promise<
		Array<{
			relationId: Id;
			meta: Record<string, unknown>;
			src: { id: Id; key: string; typeId: number; summary: string | null };
			dst: { id: Id; key: string; typeId: number; summary: string | null };
			relationTypeId: number;
			strengthTypeId: number;
			neighborId: Id;
		}>
	>;
};

export function createRelationRepo(ctx: RepoContext, types: TypeRepo): RelationRepo {
	const se = alias(schema.entity, 'se');
	const de = alias(schema.entity, 'de');
	const set2 = alias(schema.entityType, 'set2');
	const det = alias(schema.entityType, 'det');

	return {
		upsert: async (input) => {
			const relationTypeId = await types.ensureRelationTypeId(input.relationType);
			const strengthTypeId = await types.ensureStrengthTypeId(input.strength);
			const meta = input.meta ?? {};
			const rows = await ctx.db
				.insert(schema.relation)
				.values({
					srcEntityId: input.srcEntityId,
					dstEntityId: input.dstEntityId,
					relationTypeId,
					strengthTypeId,
					meta,
				})
				.onConflictDoUpdate({
					target: [
						schema.relation.srcEntityId,
						schema.relation.dstEntityId,
						schema.relation.relationTypeId,
						schema.relation.strengthTypeId,
					],
					set: { meta },
				})
				.returning({ id: schema.relation.id });
			return coerceId(rows[0]?.id, 'relation');
		},

		countIncomingOutgoing: async ({ entityId }) => {
			const incomingRows = await ctx.db
				.select({ count: sql<number>`count(*)` })
				.from(schema.relation)
				.where(eq(schema.relation.dstEntityId, entityId));
			const outgoingRows = await ctx.db
				.select({ count: sql<number>`count(*)` })
				.from(schema.relation)
				.where(eq(schema.relation.srcEntityId, entityId));
			return {
				incoming: Number(incomingRows[0]?.count ?? 0),
				outgoing: Number(outgoingRows[0]?.count ?? 0),
			};
		},

		countIncomingOutgoingByEntityIds: async ({ entityIds }) => {
			const out = new Map<Id, { incoming: number; outgoing: number }>();
			if (entityIds.length === 0) return out;

			const incomingRows = await ctx.db
				.select({ entityId: schema.relation.dstEntityId, count: sql<number>`count(*)` })
				.from(schema.relation)
				.where(inArray(schema.relation.dstEntityId, entityIds))
				.groupBy(schema.relation.dstEntityId);
			for (const r of incomingRows) {
				out.set(r.entityId, { incoming: Number(r.count ?? 0), outgoing: 0 });
			}

			const outgoingRows = await ctx.db
				.select({ entityId: schema.relation.srcEntityId, count: sql<number>`count(*)` })
				.from(schema.relation)
				.where(inArray(schema.relation.srcEntityId, entityIds))
				.groupBy(schema.relation.srcEntityId);
			for (const r of outgoingRows) {
				const prev = out.get(r.entityId);
				if (prev) {
					out.set(r.entityId, { incoming: prev.incoming, outgoing: Number(r.count ?? 0) });
				} else {
					out.set(r.entityId, { incoming: 0, outgoing: Number(r.count ?? 0) });
				}
			}

			return out;
		},

		listByEntityId: async ({ entityId, direction, limit }) => {
			if (direction === 'incoming') {
				const rows = await ctx.db
					.select({
						relationId: schema.relation.id,
						srcEntityId: schema.relation.srcEntityId,
						dstEntityId: schema.relation.dstEntityId,
						relationTypeId: schema.relation.relationTypeId,
						strengthTypeId: schema.relation.strengthTypeId,
						meta: schema.relation.meta,
					})
					.from(schema.relation)
					.where(eq(schema.relation.dstEntityId, entityId))
					.limit(limit);
				return rows.map((r) => ({ ...r, meta: (r.meta ?? {}) as Record<string, unknown> }));
			}
			if (direction === 'outgoing') {
				const rows = await ctx.db
					.select({
						relationId: schema.relation.id,
						srcEntityId: schema.relation.srcEntityId,
						dstEntityId: schema.relation.dstEntityId,
						relationTypeId: schema.relation.relationTypeId,
						strengthTypeId: schema.relation.strengthTypeId,
						meta: schema.relation.meta,
					})
					.from(schema.relation)
					.where(eq(schema.relation.srcEntityId, entityId))
					.limit(limit);
				return rows.map((r) => ({ ...r, meta: (r.meta ?? {}) as Record<string, unknown> }));
			}
			const incoming = await ctx.db
				.select({
					relationId: schema.relation.id,
					srcEntityId: schema.relation.srcEntityId,
					dstEntityId: schema.relation.dstEntityId,
					relationTypeId: schema.relation.relationTypeId,
					strengthTypeId: schema.relation.strengthTypeId,
					meta: schema.relation.meta,
				})
				.from(schema.relation)
				.where(eq(schema.relation.dstEntityId, entityId))
				.limit(limit);
			const outgoing = await ctx.db
				.select({
					relationId: schema.relation.id,
					srcEntityId: schema.relation.srcEntityId,
					dstEntityId: schema.relation.dstEntityId,
					relationTypeId: schema.relation.relationTypeId,
					strengthTypeId: schema.relation.strengthTypeId,
					meta: schema.relation.meta,
				})
				.from(schema.relation)
				.where(eq(schema.relation.srcEntityId, entityId))
				.limit(limit);
			return [...incoming, ...outgoing]
				.map((r) => ({ ...r, meta: (r.meta ?? {}) as Record<string, unknown> }))
				.slice(0, limit);
		},

		listEdgesFrom: async ({ srcEntityIds }) => {
			if (srcEntityIds.length === 0) return [];
			return await ctx.db
				.select({
					viaId: schema.relation.srcEntityId,
					id: schema.entity.id,
					entityKey: schema.entity.entityKey,
					entityTypeId: schema.entity.entityTypeId,
					summary: schema.entity.summary,
					relationTypeId: schema.relation.relationTypeId,
					strengthTypeId: schema.relation.strengthTypeId,
				})
				.from(schema.relation)
				.innerJoin(schema.entity, eq(schema.entity.id, schema.relation.dstEntityId))
				.where(and(inArray(schema.relation.srcEntityId, srcEntityIds), eq(schema.entity.isDeleted, false)));
		},

		listEdgesTo: async ({ dstEntityIds }) => {
			if (dstEntityIds.length === 0) return [];
			return await ctx.db
				.select({
					viaId: schema.relation.dstEntityId,
					id: schema.entity.id,
					entityKey: schema.entity.entityKey,
					entityTypeId: schema.entity.entityTypeId,
					summary: schema.entity.summary,
					relationTypeId: schema.relation.relationTypeId,
					strengthTypeId: schema.relation.strengthTypeId,
				})
				.from(schema.relation)
				.innerJoin(schema.entity, eq(schema.entity.id, schema.relation.srcEntityId))
				.where(and(inArray(schema.relation.dstEntityId, dstEntityIds), eq(schema.entity.isDeleted, false)));
		},

		listOutgoingForFrontier: async ({ srcEntityIds, relationTypeId, limit }) => {
			if (srcEntityIds.length === 0 || limit <= 0) return [];
			const where = relationTypeId == null
				? and(inArray(schema.relation.srcEntityId, srcEntityIds), eq(de.isDeleted, false))
				: and(
					inArray(schema.relation.srcEntityId, srcEntityIds),
					eq(schema.relation.relationTypeId, relationTypeId),
					eq(de.isDeleted, false),
				);

			const rows = await ctx.db
				.select({
					relationId: schema.relation.id,
					meta: schema.relation.meta,
					srcId: se.id,
					srcKey: se.entityKey,
					srcTypeId: se.entityTypeId,
					srcSummary: se.summary,
					dstId: de.id,
					dstKey: de.entityKey,
					dstTypeId: de.entityTypeId,
					dstSummary: de.summary,
					relationTypeId: schema.relation.relationTypeId,
					strengthTypeId: schema.relation.strengthTypeId,
					neighborId: de.id,
				})
				.from(schema.relation)
				.innerJoin(se, eq(se.id, schema.relation.srcEntityId))
				.innerJoin(set2, eq(set2.id, se.entityTypeId))
				.innerJoin(de, eq(de.id, schema.relation.dstEntityId))
				.innerJoin(det, eq(det.id, de.entityTypeId))
				.where(where)
				.limit(limit);

			return rows.map((r) => ({
				relationId: r.relationId,
				meta: (r.meta ?? {}) as Record<string, unknown>,
				src: { id: r.srcId, key: r.srcKey, typeId: r.srcTypeId, summary: r.srcSummary ?? null },
				dst: { id: r.dstId, key: r.dstKey, typeId: r.dstTypeId, summary: r.dstSummary ?? null },
				relationTypeId: r.relationTypeId,
				strengthTypeId: r.strengthTypeId,
				neighborId: r.neighborId,
			}));
		},

		listIncomingForFrontier: async ({ dstEntityIds, relationTypeId, limit }) => {
			if (dstEntityIds.length === 0 || limit <= 0) return [];
			const where = relationTypeId == null
				? and(inArray(schema.relation.dstEntityId, dstEntityIds), eq(se.isDeleted, false))
				: and(
					inArray(schema.relation.dstEntityId, dstEntityIds),
					eq(schema.relation.relationTypeId, relationTypeId),
					eq(se.isDeleted, false),
				);

			const rows = await ctx.db
				.select({
					relationId: schema.relation.id,
					meta: schema.relation.meta,
					srcId: se.id,
					srcKey: se.entityKey,
					srcTypeId: se.entityTypeId,
					srcSummary: se.summary,
					dstId: de.id,
					dstKey: de.entityKey,
					dstTypeId: de.entityTypeId,
					dstSummary: de.summary,
					relationTypeId: schema.relation.relationTypeId,
					strengthTypeId: schema.relation.strengthTypeId,
					neighborId: se.id,
				})
				.from(schema.relation)
				.innerJoin(se, eq(se.id, schema.relation.srcEntityId))
				.innerJoin(set2, eq(set2.id, se.entityTypeId))
				.innerJoin(de, eq(de.id, schema.relation.dstEntityId))
				.innerJoin(det, eq(det.id, de.entityTypeId))
				.where(where)
				.limit(limit);

			return rows.map((r) => ({
				relationId: r.relationId,
				meta: (r.meta ?? {}) as Record<string, unknown>,
				src: { id: r.srcId, key: r.srcKey, typeId: r.srcTypeId, summary: r.srcSummary ?? null },
				dst: { id: r.dstId, key: r.dstKey, typeId: r.dstTypeId, summary: r.dstSummary ?? null },
				relationTypeId: r.relationTypeId,
				strengthTypeId: r.strengthTypeId,
				neighborId: r.neighborId,
			}));
		},
	};
}
