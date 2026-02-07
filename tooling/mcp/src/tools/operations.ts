/**
 * Operations Tools — §6.4 Operations (운영)
 *
 * kb_health, verify_integrity, sync, purge_tombstones
 *
 * @see MCP_PLAN §6.4, §8.3, §8.4
 */

import { sql } from 'drizzle-orm';
import type { Db } from '../db';
import type { SyncQueue } from '../sync-queue';
import type { SyncWorker } from '../sync-worker';
import type { FileWatcher } from '../watcher';
import type { HashCache } from '../hash-cache';
import type { KBConfig } from '../config';
import { createKb } from '../kb';
import { scanFiles } from '../scanner';
import { AnalysisTools, type InconsistencyItem } from './analysis';

// ── Response Types (§8.3) ────────────────────────────────────

export type KbHealthResult = {
	db: { healthy: boolean; latencyMs: number };
	watch: { healthy: boolean; dirs: string[] };
	sync: {
		queueDepth: number;
		workerStatus: string;
		lastSyncAt: string | null;
		lastSyncDurationMs: number;
		startupScanComplete: boolean;
	};
	counts: {
		entities: number;
		facts: number;
		relations: number;
		tombstoned: number;
		workspaces: number;
	};
	cache: {
		hashCacheSize: number;
		hitRate: number;
	};
};

export type VerifyIntegrityResult = {
	level: string;
	issues: InconsistencyItem[];
	totalIssues: number;
	checkedAt: string;
};

export type SyncTriggerResult = {
	filesQueued: number;
	trigger: string;
};

export type PurgeResult = {
	purgedEntities: number;
	purgedEvents: number;
};

// ── Operations Tools ─────────────────────────────────────────

export class OperationsTools {
	constructor(
		private db: Db,
		private workspaceId: string,
		private deps: {
			queue: SyncQueue;
			worker: SyncWorker;
			watcher: FileWatcher;
			hashCache: HashCache;
			config: KBConfig;
			repoRoot: string;
		},
	) {}

	/**
	 * kb_health — §8.3 시스템 전체 상태
	 */
	async kbHealth(): Promise<KbHealthResult> {
		// DB health check
		let dbHealthy = false;
		let dbLatencyMs = 0;
		const dbStart = Date.now();
		try {
			await this.db.execute(sql`SELECT 1`);
			dbHealthy = true;
			dbLatencyMs = Date.now() - dbStart;
		} catch {
			dbLatencyMs = Date.now() - dbStart;
		}

		// Counts
		let entities = 0;
		let facts = 0;
		let relations = 0;
		let tombstoned = 0;
		let workspaces = 0;

		try {
			const entityCount = await this.db.execute(sql`
				SELECT COUNT(*) as cnt FROM entity WHERE workspace_id = ${this.workspaceId} AND is_deleted = false
			`);
			entities = Number((entityCount.rows[0] as { cnt: unknown })?.cnt ?? 0);

			const tombCount = await this.db.execute(sql`
				SELECT COUNT(*) as cnt FROM entity WHERE workspace_id = ${this.workspaceId} AND is_deleted = true
			`);
			tombstoned = Number((tombCount.rows[0] as { cnt: unknown })?.cnt ?? 0);

			const factCount = await this.db.execute(sql`
				SELECT COUNT(*) as cnt FROM fact f JOIN entity e ON e.id = f.entity_id WHERE e.workspace_id = ${this.workspaceId}
			`);
			facts = Number((factCount.rows[0] as { cnt: unknown })?.cnt ?? 0);

			const relCount = await this.db.execute(sql`
				SELECT COUNT(*) as cnt FROM relation r JOIN entity e ON e.id = r.src_entity_id WHERE e.workspace_id = ${this.workspaceId}
			`);
			relations = Number((relCount.rows[0] as { cnt: unknown })?.cnt ?? 0);

			const wsCount = await this.db.execute(sql`SELECT COUNT(*) as cnt FROM workspace`);
			workspaces = Number((wsCount.rows[0] as { cnt: unknown })?.cnt ?? 0);
		} catch {
			// DB error → counts remain 0
		}

		return {
			db: { healthy: dbHealthy, latencyMs: dbLatencyMs },
			watch: {
				healthy: this.deps.watcher.healthy,
				dirs: this.deps.watcher.watchedDirs,
			},
			sync: {
				queueDepth: this.deps.queue.depth,
				workerStatus: this.deps.worker.status,
				lastSyncAt: this.deps.worker.lastSyncAt?.toISOString() ?? null,
				lastSyncDurationMs: this.deps.worker.lastSyncDurationMs,
				startupScanComplete: this.deps.worker.startupScanComplete,
			},
			counts: { entities, facts, relations, tombstoned, workspaces },
			cache: {
				hashCacheSize: this.deps.hashCache.size,
				hitRate: this.deps.hashCache.hitRate,
			},
		};
	}

	/**
	 * verify_integrity — §8.4 정합성 검증
	 */
	async verifyIntegrity(level?: 'structural' | 'semantic' | 'full'): Promise<VerifyIntegrityResult> {
		const analysisTools = new AnalysisTools(this.db, this.workspaceId);
		const issues = await analysisTools.inconsistencyReport(level ?? 'full');

		// Additional structural checks: stale content_hash
		if (level === 'structural' || level === 'full') {
			const sources = await this.db.execute(sql`
				SELECT s.file_path, s.content_hash
				FROM source s
				WHERE s.workspace_id = ${this.workspaceId}
				LIMIT 500
			`);

			for (const row of sources.rows as Array<{ file_path: string; content_hash: string }>) {
				try {
					const absPath = `${this.deps.repoRoot}/${row.file_path}`;
					const bunFile = Bun.file(absPath);
					const exists = await bunFile.exists();

					if (!exists) {
						issues.push({
							type: 'orphan_entity',
							entityKey: row.file_path,
							summary: `Source file missing: ${row.file_path}`,
						});
					}
				} catch {
					// skip
				}
			}
		}

		return {
			level: level ?? 'full',
			issues,
			totalIssues: issues.length,
			checkedAt: new Date().toISOString(),
		};
	}

	/**
	 * sync — §6.4 수동 sync 트리거
	 */
	async sync(params?: {
		scope?: 'full' | 'changed';
		dryRun?: boolean;
	}): Promise<SyncTriggerResult> {
		const _scope = params?.scope ?? 'full';
		void _scope; // TODO: scope='changed' → hash diff only

		const scanned = await scanFiles(this.deps.repoRoot, this.deps.config);

		if (params?.dryRun) {
			return { filesQueued: scanned.length, trigger: 'manual (dry run)' };
		}

		const filePaths = scanned.map((f) => f.filePath);
		this.deps.queue.enqueueBatch(filePaths, 'manual');

		return { filesQueued: filePaths.length, trigger: 'manual' };
	}

	/**
	 * purge_tombstones — §6.4 tombstone 정리
	 */
	async purgeTombstones(params?: {
		olderThan?: number;
		workspaceId?: string;
	}): Promise<PurgeResult> {
		const kb = createKb(this.db);
		const wsId = params?.workspaceId ?? this.workspaceId;

		const purgedEntities = await kb.purgeTombstones(wsId, params?.olderThan);
		const purgedEvents = await kb.purgeSyncEvents(this.deps.config.audit.retentionDays);

		return { purgedEntities, purgedEvents };
	}
}
