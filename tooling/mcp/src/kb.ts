import type { Db } from './db';
import { sql } from 'drizzle-orm';

// ── Types ────────────────────────────────────────────────────

export type Id = number;

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

// ── Helpers ──────────────────────────────────────────────────

function clampPayloadText(text: string): string {
	const trimmed = text.trim();
	if (trimmed.length <= 4000) return trimmed;
	return `${trimmed.slice(0, 3990)}…`;
}

function coerceId(value: unknown, context: string): number {
	if (typeof value === 'number') return value;
	if (typeof value === 'bigint') {
		const max = BigInt(Number.MAX_SAFE_INTEGER);
		const min = BigInt(Number.MIN_SAFE_INTEGER);
		if (value <= max && value >= min) return Number(value);
		throw new Error(`Returned id is out of JS safe integer range (${context})`);
	}
	if (typeof value === 'string') {
		if (/^\d+$/.test(value)) {
			const n = Number(value);
			if (Number.isSafeInteger(n)) return n;
		}
		throw new Error(`Returned id is not a safe integer string (${context})`);
	}
	throw new Error(`Returned id has unexpected type (${context})`);
}

// ── KB Factory ───────────────────────────────────────────────

export function createKb(db: Db) {
	const typeCache = new Map<string, Id>();

	// ── Type Resolution ──────────────────────────────────────

	type TypeTable = 'entity_type' | 'fact_type' | 'relation_type' | 'strength_type';

	async function ensureType(table: TypeTable, name: string): Promise<Id> {
		const key = `${table}:${name}`;
		const cached = typeCache.get(key);
		if (cached) return cached;

		const insert = await db.execute(
			sql`INSERT INTO ${sql.raw(table)} (name) VALUES (${name}) ON CONFLICT (name) DO NOTHING RETURNING id`,
		);

		let id: Id | undefined;
		if (insert.rows[0]) {
			const rawId = (insert.rows[0] as { id?: unknown } | undefined)?.id;
			if (rawId != null) id = coerceId(rawId, `type:${table}:${name}`);
		}

		if (id == null) {
			const select = await db.execute(sql`SELECT id FROM ${sql.raw(table)} WHERE name = ${name}`);
			const row = select.rows[0] as { id?: unknown } | undefined;
			if (!row || row.id == null) throw new Error(`Failed to resolve type id for ${table}:${name}`);
			id = coerceId(row.id, `type:${table}:${name}`);
		}

		typeCache.set(key, id);
		return id;
	}

	// ── Workspace ────────────────────────────────────────────

	async function ensureWorkspace(id: string, hostname: string, repoRoot: string): Promise<void> {
		await db.execute(sql`
			INSERT INTO workspace (id, hostname, repo_root)
			VALUES (${id}, ${hostname}, ${repoRoot})
			ON CONFLICT (id) DO NOTHING
		`);
	}

	// ── Entity ───────────────────────────────────────────────

	async function upsertEntity(input: EntityInput, runId: Id): Promise<Id> {
		const entityTypeId = await ensureType('entity_type', input.entityType);
		const metaJson = JSON.stringify(input.meta ?? {});
		const result = await db.execute(sql`
			INSERT INTO entity (
				workspace_id, entity_key, entity_type_id,
				summary, meta, is_deleted, last_seen_run
			)
			VALUES (
				${input.workspaceId}, ${input.entityKey}, ${entityTypeId},
				${input.summary ?? null}, ${metaJson}::jsonb, false, ${runId}
			)
			ON CONFLICT ON CONSTRAINT entity_workspace_key
			DO UPDATE SET
				entity_type_id = EXCLUDED.entity_type_id,
				summary = EXCLUDED.summary,
				meta = EXCLUDED.meta,
				is_deleted = false,
				last_seen_run = ${runId},
				updated_at = now()
			RETURNING id
		`);
		const rawId = (result.rows[0] as { id?: unknown } | undefined)?.id;
		return coerceId(rawId, `entity:${input.entityKey}`);
	}

	// ── Source ────────────────────────────────────────────────

	async function upsertSource(input: SourceInput): Promise<Id> {
		const result = await db.execute(sql`
			INSERT INTO source (
				workspace_id, entity_id, kind,
				file_path, span_start, span_end, content_hash
			)
			VALUES (
				${input.workspaceId}, ${input.entityId}, ${input.kind},
				${input.filePath}, ${input.spanStart ?? null}, ${input.spanEnd ?? null},
				${input.contentHash}
			)
			ON CONFLICT ON CONSTRAINT source_workspace_loc
			DO UPDATE SET
				entity_id = EXCLUDED.entity_id,
				content_hash = EXCLUDED.content_hash
			RETURNING id
		`);
		const rawId = (result.rows[0] as { id?: unknown } | undefined)?.id;
		return coerceId(rawId, `source:${input.filePath}`);
	}

	// ── Fact ─────────────────────────────────────────────────

	async function upsertFact(input: FactInput): Promise<Id> {
		const factTypeId = await ensureType('fact_type', input.factType);
		const payloadJson = JSON.stringify(input.payloadJson ?? {});
		const payloadText = input.payloadText ? clampPayloadText(input.payloadText) : null;
		const result = await db.execute(sql`
			INSERT INTO fact (
				entity_id, fact_type_id, fact_key,
				payload_text, payload_json, content_hash
			)
			VALUES (
				${input.entityId}, ${factTypeId}, ${input.factKey},
				${payloadText}, ${payloadJson}::jsonb, ${input.contentHash ?? null}
			)
			ON CONFLICT ON CONSTRAINT fact_entity_type_key
			DO UPDATE SET
				payload_text = EXCLUDED.payload_text,
				payload_json = EXCLUDED.payload_json,
				content_hash = EXCLUDED.content_hash
			RETURNING id
		`);
		const rawId = (result.rows[0] as { id?: unknown } | undefined)?.id;
		return coerceId(rawId, `fact:${input.factKey}`);
	}

	// ── Relation ─────────────────────────────────────────────

	async function upsertRelation(input: RelationInput): Promise<Id> {
		const relationTypeId = await ensureType('relation_type', input.relationType);
		const strengthId = await ensureType('strength_type', input.strength);
		const metaJson = JSON.stringify(input.meta ?? {});
		const result = await db.execute(sql`
			INSERT INTO relation (
				src_entity_id, dst_entity_id,
				relation_type_id, strength_type_id, meta
			)
			VALUES (
				${input.srcEntityId}, ${input.dstEntityId},
				${relationTypeId}, ${strengthId}, ${metaJson}::jsonb
			)
			ON CONFLICT ON CONSTRAINT relation_unique
			DO UPDATE SET meta = EXCLUDED.meta
			RETURNING id
		`);
		const rawId = (result.rows[0] as { id?: unknown } | undefined)?.id;
		return coerceId(rawId, 'relation');
	}

	// ── Relation Evidence ────────────────────────────────────

	async function linkRelationEvidence(relationId: Id, factId: Id): Promise<void> {
		await db.execute(sql`
			INSERT INTO relation_evidence (relation_id, fact_id)
			VALUES (${relationId}, ${factId})
			ON CONFLICT ON CONSTRAINT relation_evidence_pkey DO NOTHING
		`);
	}

	// ── Sync Run ─────────────────────────────────────────────

	async function beginSyncRun(
		workspaceId: string,
		trigger: 'startup' | 'watch' | 'manual' | 'read_through',
	): Promise<Id> {
		const result = await db.execute(sql`
			INSERT INTO sync_run (workspace_id, trigger, status)
			VALUES (${workspaceId}, ${trigger}, 'running')
			RETURNING id
		`);
		const rawId = (result.rows[0] as { id?: unknown } | undefined)?.id;
		return coerceId(rawId, 'sync_run');
	}

	async function finishSyncRun(
		runId: Id,
		status: 'completed' | 'failed',
		stats?: Record<string, unknown>,
		errors?: unknown[],
	): Promise<void> {
		const statsJson = JSON.stringify(stats ?? {});
		const errorsJson = JSON.stringify(errors ?? []);
		await db.execute(sql`
			UPDATE sync_run
			SET status = ${status},
				finished_at = now(),
				stats = ${statsJson}::jsonb,
				errors = ${errorsJson}::jsonb
			WHERE id = ${runId}
		`);
	}

	// ── Sync Event (Audit Trail, append-only) ────────────────

	async function recordSyncEvent(
		runId: Id,
		entityId: Id,
		action: SyncAction,
		prevContentHash?: string,
		newContentHash?: string,
	): Promise<void> {
		await db.execute(sql`
			INSERT INTO sync_event (run_id, entity_id, action, prev_content_hash, new_content_hash)
			VALUES (${runId}, ${entityId}, ${action}, ${prevContentHash ?? null}, ${newContentHash ?? null})
		`);
	}

	// ── Tombstone / Restore ──────────────────────────────────

	async function tombstoneEntity(entityId: Id, runId: Id): Promise<void> {
		await db.execute(sql`
			UPDATE entity SET is_deleted = true, updated_at = now() WHERE id = ${entityId}
		`);
		await recordSyncEvent(runId, entityId, 'deleted');
	}

	async function restoreEntity(entityId: Id, runId: Id): Promise<void> {
		await db.execute(sql`
			UPDATE entity SET is_deleted = false, updated_at = now() WHERE id = ${entityId}
		`);
		await recordSyncEvent(runId, entityId, 'restored');
	}

	// ── Orphan Fact Cleanup (§2.8) ───────────────────────────

	async function deleteOrphanFacts(entityId: Id, retainedFactKeys: string[]): Promise<number> {
		if (retainedFactKeys.length === 0) {
			const result = await db.execute(sql`
				DELETE FROM fact WHERE entity_id = ${entityId} RETURNING id
			`);
			return result.rows.length;
		}
		// Build a VALUES list for retained keys
		const keysList = retainedFactKeys.map((k) => `(${sql.raw(`'${k.replace(/'/g, "''")}'`)})`).join(',');
		const result = await db.execute(sql`
			DELETE FROM fact
			WHERE entity_id = ${entityId}
			  AND fact_key NOT IN (SELECT v FROM (VALUES ${sql.raw(keysList)}) AS t(v))
			RETURNING id
		`);
		return result.rows.length;
	}

	// ── Purge Tombstones ─────────────────────────────────────

	async function purgeTombstones(workspaceId: string, olderThanDays?: number): Promise<number> {
		const days = olderThanDays ?? 30;
		const result = await db.execute(sql`
			DELETE FROM entity
			WHERE workspace_id = ${workspaceId}
			  AND is_deleted = true
			  AND updated_at < now() - ${`${days} days`}::interval
			RETURNING id
		`);
		return result.rows.length;
	}

	// ── Purge Sync Events (§2.8 retention) ───────────────────

	async function purgeSyncEvents(olderThanDays?: number): Promise<number> {
		const days = olderThanDays ?? 30;
		const result = await db.execute(sql`
			DELETE FROM sync_event
			WHERE created_at < now() - ${`${days} days`}::interval
			RETURNING id
		`);
		return result.rows.length;
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
