import { and, eq, inArray, sql } from 'drizzle-orm';

import * as schema from '../../drizzle/schema';
import type { RepoContext, Id } from './_shared';
import { coerceId } from './_shared';
import type { TypeRepo } from './type-repo';

export type EntityRepo = {
	upsert: (input: {
		workspaceId: string;
		entityKey: string;
		entityType: string;
		summary?: string;
		meta?: Record<string, unknown>;
		runId: Id;
	}) => Promise<Id>;
	findByWorkspaceKey: (input: { workspaceId: string; entityKey: string }) => Promise<
		| {
			id: Id;
			entityKey: string;
			entityTypeId: number;
			summary: string | null;
			meta: Record<string, unknown>;
			isDeleted: boolean;
		}
		| null
	>;
	resolveIdByKey: (input: { workspaceId: string; entityKey: string; includeDeleted?: boolean }) => Promise<Id | null>;
	findByIds: (input: { ids: Id[] }) => Promise<Array<{ id: Id; entityKey: string; entityTypeId: number; summary: string | null; isDeleted: boolean }>>;
	findByKeys: (input: { workspaceId: string; entityKeys: string[]; includeDeleted?: boolean }) => Promise<
		Array<{ id: Id; entityKey: string; entityTypeId: number; summary: string | null; meta: Record<string, unknown>; isDeleted: boolean }>
	>;
	findIdsByKeys: (input: { workspaceId: string; entityKeys: string[]; includeDeleted?: boolean }) => Promise<
		Array<{ id: Id; entityKey: string; entityTypeId: number; summary: string | null; isDeleted: boolean }>
	>;
	markDeleted: (input: { entityId: Id }) => Promise<void>;
	markRestored: (input: { entityId: Id }) => Promise<void>;
	countByWorkspace: (input: { workspaceId: string; isDeleted?: boolean }) => Promise<number>;
	findOrphans: (input: { workspaceId: string; entityTypeId?: number }) => Promise<
		Array<{ entityKey: string; entityTypeId: number; summary: string | null }>
	>;
	purgeTombstones: (input: { workspaceId: string; olderThanDays: number }) => Promise<number>;
};

export function createEntityRepo(ctx: RepoContext, types: TypeRepo): EntityRepo {
	return {
		upsert: async (input) => {
			const entityTypeId = await types.ensureEntityTypeId(input.entityType);
			const meta = input.meta ?? {};
			const rows = await ctx.db
				.insert(schema.entity)
				.values({
					workspaceId: input.workspaceId,
					entityKey: input.entityKey,
					entityTypeId,
					summary: input.summary ?? null,
					meta,
					isDeleted: false,
					lastSeenRun: input.runId,
				})
				.onConflictDoUpdate({
					target: [schema.entity.workspaceId, schema.entity.entityKey],
					set: {
						entityTypeId,
						summary: input.summary ?? null,
						meta,
						isDeleted: false,
						lastSeenRun: input.runId,
						updatedAt: sql`now()`,
					},
				})
				.returning({ id: schema.entity.id });
			return coerceId(rows[0]?.id, `entity:${input.entityKey}`);
		},

		findByWorkspaceKey: async ({ workspaceId, entityKey }) => {
			const rows = await ctx.db
				.select({
					id: schema.entity.id,
					entityKey: schema.entity.entityKey,
					entityTypeId: schema.entity.entityTypeId,
					summary: schema.entity.summary,
					meta: schema.entity.meta,
					isDeleted: schema.entity.isDeleted,
				})
				.from(schema.entity)
				.where(and(eq(schema.entity.workspaceId, workspaceId), eq(schema.entity.entityKey, entityKey)))
				.limit(1);
			const row = rows[0];
			if (!row) return null;
			return { ...row, meta: (row.meta ?? {}) as Record<string, unknown> };
		},

		resolveIdByKey: async ({ workspaceId, entityKey, includeDeleted }) => {
			const where = includeDeleted
				? and(eq(schema.entity.workspaceId, workspaceId), eq(schema.entity.entityKey, entityKey))
				: and(
					eq(schema.entity.workspaceId, workspaceId),
					eq(schema.entity.entityKey, entityKey),
					eq(schema.entity.isDeleted, false),
				);
			const rows = await ctx.db.select({ id: schema.entity.id }).from(schema.entity).where(where).limit(1);
			return rows[0]?.id ?? null;
		},

		findByIds: async ({ ids }) => {
			if (ids.length === 0) return [];
			return await ctx.db
				.select({
					id: schema.entity.id,
					entityKey: schema.entity.entityKey,
					entityTypeId: schema.entity.entityTypeId,
					summary: schema.entity.summary,
					isDeleted: schema.entity.isDeleted,
				})
				.from(schema.entity)
				.where(inArray(schema.entity.id, ids));
		},

		findByKeys: async ({ workspaceId, entityKeys, includeDeleted }) => {
			if (entityKeys.length === 0) return [];
			const where = includeDeleted
				? and(eq(schema.entity.workspaceId, workspaceId), inArray(schema.entity.entityKey, entityKeys))
				: and(
					eq(schema.entity.workspaceId, workspaceId),
					inArray(schema.entity.entityKey, entityKeys),
					eq(schema.entity.isDeleted, false),
				);
			const rows = await ctx.db
				.select({
					id: schema.entity.id,
					entityKey: schema.entity.entityKey,
					entityTypeId: schema.entity.entityTypeId,
					summary: schema.entity.summary,
					meta: schema.entity.meta,
					isDeleted: schema.entity.isDeleted,
				})
				.from(schema.entity)
				.where(where);
			return rows.map((r) => ({ ...r, meta: (r.meta ?? {}) as Record<string, unknown> }));
		},

		findIdsByKeys: async ({ workspaceId, entityKeys, includeDeleted }) => {
			if (entityKeys.length === 0) return [];
			const where = includeDeleted
				? and(eq(schema.entity.workspaceId, workspaceId), inArray(schema.entity.entityKey, entityKeys))
				: and(
					eq(schema.entity.workspaceId, workspaceId),
					inArray(schema.entity.entityKey, entityKeys),
					eq(schema.entity.isDeleted, false),
				);
			return await ctx.db
				.select({
					id: schema.entity.id,
					entityKey: schema.entity.entityKey,
					entityTypeId: schema.entity.entityTypeId,
					summary: schema.entity.summary,
					isDeleted: schema.entity.isDeleted,
				})
				.from(schema.entity)
				.where(where);
		},

		markDeleted: async ({ entityId }) => {
			await ctx.db
				.update(schema.entity)
				.set({ isDeleted: true, updatedAt: sql`now()` })
				.where(eq(schema.entity.id, entityId));
		},

		markRestored: async ({ entityId }) => {
			await ctx.db
				.update(schema.entity)
				.set({ isDeleted: false, updatedAt: sql`now()` })
				.where(eq(schema.entity.id, entityId));
		},

		countByWorkspace: async ({ workspaceId, isDeleted }) => {
			const where =
				isDeleted == null
					? eq(schema.entity.workspaceId, workspaceId)
					: and(eq(schema.entity.workspaceId, workspaceId), eq(schema.entity.isDeleted, isDeleted));
			const rows = await ctx.db
				.select({ count: sql<number>`count(*)` })
				.from(schema.entity)
				.where(where);
			return Number(rows[0]?.count ?? 0);
		},

		findOrphans: async ({ workspaceId, entityTypeId }) => {
			const typeFilter = entityTypeId == null ? sql`true` : eq(schema.entity.entityTypeId, entityTypeId);
			return await ctx.db
				.select({
					entityKey: schema.entity.entityKey,
					entityTypeId: schema.entity.entityTypeId,
					summary: schema.entity.summary,
				})
				.from(schema.entity)
				.where(
					and(
						eq(schema.entity.workspaceId, workspaceId),
						eq(schema.entity.isDeleted, false),
						typeFilter,
						sql`NOT EXISTS (SELECT 1 FROM relation r WHERE r.src_entity_id = ${schema.entity.id} OR r.dst_entity_id = ${schema.entity.id})`,
					),
				);
		},

		purgeTombstones: async ({ workspaceId, olderThanDays }) => {
			const deleted = await ctx.db
				.delete(schema.entity)
				.where(
					and(
						eq(schema.entity.workspaceId, workspaceId),
						eq(schema.entity.isDeleted, true),
						sql`${schema.entity.updatedAt} < now() - ${olderThanDays} * interval '1 day'`,
					),
				)
				.returning({ id: schema.entity.id });
			return deleted.length;
		},
	};
}
