import { eq, sql } from 'drizzle-orm';

import * as schema from '../../drizzle/schema';
import type { RepoContext, Id } from './_shared';
import { coerceId } from './_shared';

export type SyncRunRepo = {
	begin: (input: { workspaceId: string; trigger: 'startup' | 'watch' | 'manual' | 'read_through' }) => Promise<Id>;
	finish: (input: { runId: Id; status: 'completed' | 'failed'; stats?: Record<string, unknown>; errors?: unknown[] }) => Promise<void>;
};

export function createSyncRunRepo(ctx: RepoContext): SyncRunRepo {
	return {
		begin: async ({ workspaceId, trigger }) => {
			const rows = await ctx.db
				.insert(schema.syncRun)
				.values({ workspaceId, trigger, status: 'running' })
				.returning({ id: schema.syncRun.id });
			return coerceId(rows[0]?.id, 'sync_run');
		},

		finish: async ({ runId, status, stats, errors }) => {
			await ctx.db
				.update(schema.syncRun)
				.set({
					status,
					finishedAt: sql`now()`,
					stats: stats ?? {},
					errors: errors ?? [],
				})
				.where(eq(schema.syncRun.id, runId));
		},
	};
}
