import type { DbLike } from '../db';

import type { RepoContext } from './_shared';
import { createTypeRepo } from './type-repo';
import { createWorkspaceRepo } from './workspace-repo';
import { createEntityRepo } from './entity-repo';
import { createSourceRepo } from './source-repo';
import { createFactRepo } from './fact-repo';
import { createRelationRepo } from './relation-repo';
import { createRelationEvidenceRepo } from './relation-evidence-repo';
import { createSyncRunRepo } from './sync-run-repo';
import { createSyncEventRepo } from './sync-event-repo';

export function createRepos(db: DbLike) {
	const ctx: RepoContext = { db };
	const types = createTypeRepo(ctx);

	return {
		types,
		workspace: createWorkspaceRepo(ctx),
		entity: createEntityRepo(ctx, types),
		source: createSourceRepo(ctx),
		fact: createFactRepo(ctx, types),
		relation: createRelationRepo(ctx, types),
		relationEvidence: createRelationEvidenceRepo(ctx),
		syncRun: createSyncRunRepo(ctx),
		syncEvent: createSyncEventRepo(ctx),
	};
}
