import type { DbLike } from './db';
import { createRepos } from './repo';
import type { Id } from './repo/_shared';

// ── Types ────────────────────────────────────────────────────

export type EntityInput = {
	workspaceId: string;
	entityKey: string;
	entityType: string;
	summary?: string;
	meta?: Record<string, unknown>;
};

export type SourceInput = {
	workspaceId: string;
	entityId: Id;
	kind: string;
	filePath: string;
	spanStart?: number;
	spanEnd?: number;
	contentHash: string;
};

export type FactInput = {
	entityId: Id;
	factType: string;
	factKey: string;
	payloadText?: string;
	payloadJson?: Record<string, unknown>;
	contentHash?: string;
};

export type RelationInput = {
	srcEntityId: Id;
	dstEntityId: Id;
	relationType: string;
	strength: string;
	meta?: Record<string, unknown>;
};

export type SyncAction = 'created' | 'updated' | 'deleted' | 'restored';

// ── KB Factory ───────────────────────────────────────────────

export function createKb(db: DbLike) {
	const repos = createRepos(db);

	async function ensureType(table: 'entity_type' | 'fact_type' | 'relation_type' | 'strength_type', name: string): Promise<Id> {
		if (table === 'entity_type') return repos.types.ensureEntityTypeId(name);
		if (table === 'fact_type') return repos.types.ensureFactTypeId(name);
		if (table === 'relation_type') return repos.types.ensureRelationTypeId(name);
		if (table === 'strength_type') return repos.types.ensureStrengthTypeId(name);
		const _exhaustive: never = table;
		return _exhaustive;
	}

	async function ensureWorkspace(id: string, hostname: string, repoRoot: string): Promise<void> {
		await repos.workspace.ensureWorkspace({ id, hostname, repoRoot });
	}

	async function upsertEntity(input: EntityInput, runId: Id): Promise<Id> {
		const params: {
			workspaceId: string;
			entityKey: string;
			entityType: string;
			runId: Id;
			summary?: string;
			meta?: Record<string, unknown>;
		} = {
			workspaceId: input.workspaceId,
			entityKey: input.entityKey,
			entityType: input.entityType,
			runId,
		};
		if (input.summary !== undefined) params.summary = input.summary;
		if (input.meta !== undefined) params.meta = input.meta;
		return await repos.entity.upsert(params);
	}

	async function upsertSource(input: SourceInput): Promise<Id> {
		return await repos.source.upsert(input);
	}

	async function upsertFact(input: FactInput): Promise<Id> {
		return await repos.fact.upsert(input);
	}

	async function upsertRelation(input: RelationInput): Promise<Id> {
		return await repos.relation.upsert(input);
	}

	async function linkRelationEvidence(relationId: Id, factId: Id): Promise<void> {
		await repos.relationEvidence.link({ relationId, factId });
	}

	async function beginSyncRun(
		workspaceId: string,
		trigger: 'startup' | 'watch' | 'manual' | 'read_through',
	): Promise<Id> {
		return await repos.syncRun.begin({ workspaceId, trigger });
	}

	async function finishSyncRun(
		runId: Id,
		status: 'completed' | 'failed',
		stats?: Record<string, unknown>,
		errors?: unknown[],
	): Promise<void> {
		const params: {
			runId: Id;
			status: 'completed' | 'failed';
			stats?: Record<string, unknown>;
			errors?: unknown[];
		} = { runId, status };
		if (stats !== undefined) params.stats = stats;
		if (errors !== undefined) params.errors = errors;
		await repos.syncRun.finish(params);
	}

	async function recordSyncEvent(
		runId: Id,
		entityId: Id,
		action: SyncAction,
		prevContentHash?: string,
		newContentHash?: string,
	): Promise<void> {
		const params: {
			runId: Id;
			entityId: Id;
			action: SyncAction;
			prevContentHash?: string;
			newContentHash?: string;
		} = { runId, entityId, action };
		if (prevContentHash !== undefined) params.prevContentHash = prevContentHash;
		if (newContentHash !== undefined) params.newContentHash = newContentHash;
		await repos.syncEvent.record(params);
	}

	async function tombstoneEntity(entityId: Id, runId: Id): Promise<void> {
		await repos.entity.markDeleted({ entityId });
		await recordSyncEvent(runId, entityId, 'deleted');
	}

	async function restoreEntity(entityId: Id, runId: Id): Promise<void> {
		await repos.entity.markRestored({ entityId });
		await recordSyncEvent(runId, entityId, 'restored');
	}

	async function deleteOrphanFacts(entityId: Id, retainedFactKeys: string[]): Promise<number> {
		return await repos.fact.deleteOrphans({ entityId, retainedFactKeys });
	}

	async function purgeTombstones(workspaceId: string, olderThanDays?: number): Promise<number> {
		return await repos.entity.purgeTombstones({ workspaceId, olderThanDays: olderThanDays ?? 30 });
	}

	async function purgeSyncEvents(olderThanDays?: number): Promise<number> {
		return await repos.syncEvent.purgeOlderThanDays({ olderThanDays: olderThanDays ?? 30 });
	}

	return {
		ensureType,
		ensureWorkspace,
		upsertEntity,
		upsertSource,
		upsertFact,
		upsertRelation,
		linkRelationEvidence,
		beginSyncRun,
		finishSyncRun,
		recordSyncEvent,
		tombstoneEntity,
		restoreEntity,
		deleteOrphanFacts,
		purgeTombstones,
		purgeSyncEvents,
	};
}
