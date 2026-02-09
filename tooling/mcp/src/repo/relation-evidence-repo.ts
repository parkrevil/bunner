import { eq } from 'drizzle-orm';

import * as schema from '../../drizzle/schema';
import type { RepoContext, Id } from './_shared';

export type RelationEvidenceRepo = {
	link: (input: { relationId: Id; factId: Id }) => Promise<void>;
	listEvidenceFacts: (input: { relationId: Id }) => Promise<
		Array<{ factId: Id; factKey: string; factTypeId: number; payloadText: string | null }>
	>;
};

export function createRelationEvidenceRepo(ctx: RepoContext): RelationEvidenceRepo {
	return {
		link: async ({ relationId, factId }) => {
			await ctx.db
				.insert(schema.relationEvidence)
				.values({ relationId, factId })
				.onConflictDoNothing();
		},

		listEvidenceFacts: async ({ relationId }) => {
			return await ctx.db
				.select({
					factId: schema.fact.id,
					factKey: schema.fact.factKey,
					factTypeId: schema.fact.factTypeId,
					payloadText: schema.fact.payloadText,
				})
				.from(schema.relationEvidence)
				.innerJoin(schema.fact, eq(schema.fact.id, schema.relationEvidence.factId))
				.where(eq(schema.relationEvidence.relationId, relationId));
		},
	};
}
