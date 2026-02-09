import { eq, inArray } from 'drizzle-orm';

import * as schema from '../../drizzle/schema';
import type { RepoContext, Id } from './_shared';
import { coerceId } from './_shared';

export type SourceRepo = {
	upsert: (input: {
		workspaceId: string;
		entityId: Id;
		kind: string;
		filePath: string;
		spanStart?: number;
		spanEnd?: number;
		contentHash: string;
	}) => Promise<Id>;
	listByEntityId: (input: { entityId: Id }) => Promise<Array<{ filePath: string; kind: string; contentHash: string }>>;
	listByWorkspace: (input: { workspaceId: string; limit: number }) => Promise<Array<{ filePath: string; contentHash: string }>>;
	listByEntityIds: (input: { entityIds: Id[] }) => Promise<Array<{ entityId: Id; filePath: string; kind: string; contentHash: string }>>;
};

export function createSourceRepo(ctx: RepoContext): SourceRepo {
	return {
		upsert: async (input) => {
			const rows = await ctx.db
				.insert(schema.source)
				.values({
					workspaceId: input.workspaceId,
					entityId: input.entityId,
					kind: input.kind,
					filePath: input.filePath,
					spanStart: input.spanStart ?? null,
					spanEnd: input.spanEnd ?? null,
					contentHash: input.contentHash,
				})
				.onConflictDoUpdate({
					target: [
						schema.source.workspaceId,
						schema.source.kind,
						schema.source.filePath,
						schema.source.spanStart,
						schema.source.spanEnd,
					],
					set: {
						entityId: input.entityId,
						contentHash: input.contentHash,
					},
				})
				.returning({ id: schema.source.id });
			return coerceId(rows[0]?.id, `source:${input.filePath}`);
		},

		listByEntityId: async ({ entityId }) => {
			const rows = await ctx.db
				.select({
					filePath: schema.source.filePath,
					kind: schema.source.kind,
					contentHash: schema.source.contentHash,
				})
				.from(schema.source)
				.where(eq(schema.source.entityId, entityId));
			return rows;
		},

		listByWorkspace: async ({ workspaceId, limit }) => {
			return await ctx.db
				.select({ filePath: schema.source.filePath, contentHash: schema.source.contentHash })
				.from(schema.source)
				.where(eq(schema.source.workspaceId, workspaceId))
				.limit(limit);
		},

		listByEntityIds: async ({ entityIds }) => {
			if (entityIds.length === 0) return [];
			return await ctx.db
				.select({
					entityId: schema.source.entityId,
					filePath: schema.source.filePath,
					kind: schema.source.kind,
					contentHash: schema.source.contentHash,
				})
				.from(schema.source)
				.where(inArray(schema.source.entityId, entityIds));
		},
	};
}
