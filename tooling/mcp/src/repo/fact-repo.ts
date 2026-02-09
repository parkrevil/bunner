import { and, eq, inArray, notInArray, sql } from 'drizzle-orm';

import * as schema from '../../drizzle/schema';
import type { RepoContext, Id } from './_shared';
import { clampPayloadText, coerceId } from './_shared';
import type { TypeRepo } from './type-repo';

export type FactRepo = {
	upsert: (input: {
		entityId: Id;
		factType: string;
		factKey: string;
		payloadText?: string;
		payloadJson?: Record<string, unknown>;
		contentHash?: string;
	}) => Promise<Id>;
	listByEntityId: (input: { entityId: Id }) => Promise<
		Array<{ factKey: string; factTypeId: number; payloadText: string | null; payloadJson: Record<string, unknown> }>
	>;
	listByEntityIds: (input: { entityIds: Id[] }) => Promise<
		Array<{ entityId: Id; factKey: string; factTypeId: number; payloadText: string | null; payloadJson: Record<string, unknown> }>
	>;
	listByEntityIdFiltered: (input: { entityId: Id; factTypeId?: number; limit: number }) => Promise<
		Array<{ id: Id; factKey: string; factTypeId: number; payloadText: string | null; payloadJson: Record<string, unknown> }>
	>;
	listByEntityIdsFiltered: (input: { entityIds: Id[]; factTypeId?: number }) => Promise<
		Array<{ entityId: Id; id: Id; factKey: string; factTypeId: number; payloadText: string | null; payloadJson: Record<string, unknown> }>
	>;
	deleteOrphans: (input: { entityId: Id; retainedFactKeys: string[] }) => Promise<number>;
	searchFacts: (input: {
		workspaceId: string;
		query: string;
		limit: number;
		entityTypeId?: number;
		factTypeId?: number;
		includeDeleted: boolean;
	}) => Promise<
		Array<{
			entityKey: string;
			entitySummary: string | null;
			entityTypeId: number;
			factId: number;
			factKey: string;
			factTypeId: number;
			payloadText: string | null;
			rank: number;
		}>
	>;
};

export function createFactRepo(ctx: RepoContext, types: TypeRepo): FactRepo {
	return {
		upsert: async (input) => {
			const factTypeId = await types.ensureFactTypeId(input.factType);
			const payloadText = input.payloadText ? clampPayloadText(input.payloadText) : null;
			const payloadJson = input.payloadJson ?? {};
			const rows = await ctx.db
				.insert(schema.fact)
				.values({
					entityId: input.entityId,
					factTypeId,
					factKey: input.factKey,
					payloadText,
					payloadJson,
					contentHash: input.contentHash ?? null,
				})
				.onConflictDoUpdate({
					target: [schema.fact.entityId, schema.fact.factTypeId, schema.fact.factKey],
					set: {
						payloadText,
						payloadJson,
						contentHash: input.contentHash ?? null,
					},
				})
				.returning({ id: schema.fact.id });
			return coerceId(rows[0]?.id, `fact:${input.factKey}`);
		},

		listByEntityId: async ({ entityId }) => {
			return await ctx.db
				.select({
					factKey: schema.fact.factKey,
					factTypeId: schema.fact.factTypeId,
					payloadText: schema.fact.payloadText,
					payloadJson: schema.fact.payloadJson,
				})
				.from(schema.fact)
				.where(eq(schema.fact.entityId, entityId));
		},

		listByEntityIds: async ({ entityIds }) => {
			if (entityIds.length === 0) return [];
			return await ctx.db
				.select({
					entityId: schema.fact.entityId,
					factKey: schema.fact.factKey,
					factTypeId: schema.fact.factTypeId,
					payloadText: schema.fact.payloadText,
					payloadJson: schema.fact.payloadJson,
				})
				.from(schema.fact)
				.where(inArray(schema.fact.entityId, entityIds));
		},

		listByEntityIdFiltered: async ({ entityId, factTypeId, limit }) => {
			const where = factTypeId == null
				? eq(schema.fact.entityId, entityId)
				: and(eq(schema.fact.entityId, entityId), eq(schema.fact.factTypeId, factTypeId));
			return await ctx.db
				.select({
					id: schema.fact.id,
					factKey: schema.fact.factKey,
					factTypeId: schema.fact.factTypeId,
					payloadText: schema.fact.payloadText,
					payloadJson: schema.fact.payloadJson,
				})
				.from(schema.fact)
				.where(where)
				.limit(limit);
		},

		listByEntityIdsFiltered: async ({ entityIds, factTypeId }) => {
			if (entityIds.length === 0) return [];
			const where = factTypeId == null
				? inArray(schema.fact.entityId, entityIds)
				: and(inArray(schema.fact.entityId, entityIds), eq(schema.fact.factTypeId, factTypeId));
			return await ctx.db
				.select({
					entityId: schema.fact.entityId,
					id: schema.fact.id,
					factKey: schema.fact.factKey,
					factTypeId: schema.fact.factTypeId,
					payloadText: schema.fact.payloadText,
					payloadJson: schema.fact.payloadJson,
				})
				.from(schema.fact)
				.where(where);
		},

		deleteOrphans: async ({ entityId, retainedFactKeys }) => {
			if (retainedFactKeys.length === 0) {
				const deleted = await ctx.db
					.delete(schema.fact)
					.where(eq(schema.fact.entityId, entityId))
					.returning({ id: schema.fact.id });
				return deleted.length;
			}
			const deleted = await ctx.db
				.delete(schema.fact)
				.where(and(eq(schema.fact.entityId, entityId), notInArray(schema.fact.factKey, retainedFactKeys)))
				.returning({ id: schema.fact.id });
			return deleted.length;
		},

		searchFacts: async (input) => {
			const pattern = `%${String(input.query).replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')}%`;
			const where: unknown[] = [
				eq(schema.entity.workspaceId, input.workspaceId),
				sql`${schema.fact.payloadText} ILIKE ${pattern}`,
			];
			if (!input.includeDeleted) where.push(eq(schema.entity.isDeleted, false));
			if (input.entityTypeId != null) where.push(eq(schema.entity.entityTypeId, input.entityTypeId));
			if (input.factTypeId != null) where.push(eq(schema.fact.factTypeId, input.factTypeId));

			const rows = await ctx.db
				.select({
					entityKey: schema.entity.entityKey,
					entitySummary: schema.entity.summary,
					entityTypeId: schema.entity.entityTypeId,
					factId: schema.fact.id,
					factKey: schema.fact.factKey,
					factTypeId: schema.fact.factTypeId,
					payloadText: schema.fact.payloadText,
				})
				.from(schema.fact)
				.innerJoin(schema.entity, eq(schema.entity.id, schema.fact.entityId))
				.where(and(...(where as any)))
				.orderBy(schema.fact.entityId, schema.fact.id)
				.limit(input.limit);

			return rows.map((r) => ({ ...r, rank: 1 }));
		},
	};
}
