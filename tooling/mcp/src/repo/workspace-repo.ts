import * as schema from '../../drizzle/schema';
import type { RepoContext } from './_shared';

export type WorkspaceRepo = {
	ensureWorkspace: (params: { id: string; hostname: string; repoRoot: string }) => Promise<void>;
};

export function createWorkspaceRepo(ctx: RepoContext): WorkspaceRepo {
	return {
		ensureWorkspace: async ({ id, hostname, repoRoot }) => {
			await ctx.db.insert(schema.workspace).values({ id, hostname, repoRoot }).onConflictDoNothing();
		},
	};
}
