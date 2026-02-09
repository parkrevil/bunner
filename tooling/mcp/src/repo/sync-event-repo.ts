import { sql } from 'drizzle-orm';

import * as schema from '../../drizzle/schema';
import type { RepoContext, Id } from './_shared';

export type SyncAction = 'created' | 'updated' | 'deleted' | 'restored';

export type SyncEventRepo = {
	record: (input: {
		runId: Id;
		entityId: Id;
		action: SyncAction;
		prevContentHash?: string;
		newContentHash?: string;
	}) => Promise<void>;
	purgeOlderThanDays: (input: { olderThanDays: number }) => Promise<number>;
};

export function createSyncEventRepo(ctx: RepoContext): SyncEventRepo {
	return {
		record: async ({ runId, entityId, action, prevContentHash, newContentHash }) => {
			await ctx.db.insert(schema.syncEvent).values({
				runId,
				entityId,
				action,
				prevContentHash: prevContentHash ?? null,
				newContentHash: newContentHash ?? null,
			});
		},

		purgeOlderThanDays: async ({ olderThanDays }) => {
			const deleted = await ctx.db
				.delete(schema.syncEvent)
				.where(sql`${schema.syncEvent.createdAt} < now() - ${olderThanDays} * interval '1 day'`)
				.returning({ id: schema.syncEvent.id });
			return deleted.length;
		},
	};
}
