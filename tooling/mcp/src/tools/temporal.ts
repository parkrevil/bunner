/**
 * Temporal Tools — §6.3 Temporal (시간)
 *
 * recent_changes, changelog
 *
 * @see MCP_PLAN §5.5 Temporal, §6.3
 */

import { sql } from 'drizzle-orm';
import type { Db } from '../db';
import { coerceRows } from '../db';

// ── Response Types ───────────────────────────────────────────

export type RecentChangeItem = {
	entityKey: string;
	entityType: string;
	action: string;
	prevContentHash: string | null;
	newContentHash: string | null;
	changedAt: string;
	trigger: string;
};

export type ChangelogItem = {
	action: string;
	prevContentHash: string | null;
	newContentHash: string | null;
	changedAt: string;
	runId: number;
	trigger: string;
};

// ── Temporal Tools ───────────────────────────────────────────

export class TemporalTools {
	constructor(
		private db: Db,
		private workspaceId: string,
	) {}

	/**
	 * recent_changes — §5.5 sync_event 기반 최근 변경 entity 목록
	 */
	async recentChanges(params: {
		since?: string; // ISO date string
		limit?: number;
	}): Promise<RecentChangeItem[]> {
		return this.db.transaction(async (tx) => {
			const limit = params.limit ?? 20;

			let whereClause = sql`e.workspace_id = ${this.workspaceId}`;
			if (params.since) {
				whereClause = sql`${whereClause} AND se.created_at >= ${params.since}::timestamptz`;
			}

			const result = await tx.execute(sql`
				SELECT
					e.entity_key, et.name as entity_type,
					se.action, se.prev_content_hash, se.new_content_hash,
					se.created_at, sr.trigger
				FROM sync_event se
				JOIN entity e ON e.id = se.entity_id
				JOIN entity_type et ON et.id = e.entity_type_id
				JOIN sync_run sr ON sr.id = se.run_id
				WHERE ${whereClause}
				ORDER BY se.created_at DESC
				LIMIT ${limit}
			`);

			const rows = coerceRows(result);
			return (rows as Array<{
				entity_key: string; entity_type: string;
				action: string; prev_content_hash: string | null;
				new_content_hash: string | null; created_at: string;
				trigger: string;
			}>).map((r) => ({
				entityKey: r.entity_key,
				entityType: r.entity_type,
				action: r.action,
				prevContentHash: r.prev_content_hash,
				newContentHash: r.new_content_hash,
				changedAt: String(r.created_at),
				trigger: r.trigger,
			}));
		});
	}

	/**
	 * changelog — §5.5 특정 entity의 변경 이력 (sync_event)
	 */
	async changelog(params: {
		entityKey: string;
		limit?: number;
	}): Promise<ChangelogItem[]> {
		return this.db.transaction(async (tx) => {
			const limit = params.limit ?? 20;

			const result = await tx.execute(sql`
				SELECT
					se.action, se.prev_content_hash, se.new_content_hash,
					se.created_at, se.run_id, sr.trigger
				FROM sync_event se
				JOIN entity e ON e.id = se.entity_id
				JOIN sync_run sr ON sr.id = se.run_id
				WHERE e.workspace_id = ${this.workspaceId}
				  AND e.entity_key = ${params.entityKey}
				ORDER BY se.created_at DESC
				LIMIT ${limit}
			`);

			const rows = coerceRows(result);
			return (rows as Array<{
				action: string; prev_content_hash: string | null;
				new_content_hash: string | null; created_at: string;
				run_id: number; trigger: string;
			}>).map((r) => ({
				action: r.action,
				prevContentHash: r.prev_content_hash,
				newContentHash: r.new_content_hash,
				changedAt: String(r.created_at),
				runId: r.run_id,
				trigger: r.trigger,
			}));
		});
	}
}
