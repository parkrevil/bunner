/**
 * Operations Tools — §6.4 Operations (운영)
 *
 * verify_integrity, sync, purge_tombstones
 *
 * Worker 스레드와 IPC로 통신. 직접 SyncWorker/FileWatcher/SyncQueue 참조 없음.
 *
 * @see MCP_PLAN §6.4, §8.3, §8.4
 */

import { sql } from 'drizzle-orm';
import type { Db } from '../db';
import { coerceRows } from '../db';
import type { HashCache } from '../hash-cache';
import type { KBConfig } from '../config';
import type { SyncCommand, SyncWorkerStatus } from '../sync-ipc';
import { createKb } from '../kb';
import { AnalysisTools, type InconsistencyItem } from './analysis';

// ── Response Types (§8.3) ────────────────────────────────────

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

/** Worker 스레드 상태를 가져오고 명령을 보내는 인터페이스 */
export type OperationsDeps = {
	getStatus: () => SyncWorkerStatus;
	sendCommand: (cmd: SyncCommand) => void;
	hashCache: HashCache;
	config: KBConfig;
	repoRoot: string;
};

// ── Operations Tools ─────────────────────────────────────────

export class OperationsTools {
	constructor(
		private db: Db,
		private workspaceId: string,
		private deps: OperationsDeps,
	) {}

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

			const sourceRows = coerceRows(sources);
			for (const row of sourceRows as Array<{ file_path: string; content_hash: string }>) {
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
	 * Worker 스레드에 IPC 명령으로 전달.
	 */
	async sync(params?: {
		scope?: 'full' | 'changed';
		dryRun?: boolean;
	}): Promise<SyncTriggerResult> {
		const scope = params?.scope ?? 'full';

		if (params?.dryRun) {
			// dry run — 메인 스레드에서 스캔만 수행 (Worker에 보내지 않음)
			const { scanFiles } = await import('../scanner');
			const scanned = await scanFiles(this.deps.repoRoot, this.deps.config);
			return { filesQueued: scanned.length, trigger: 'manual (dry run)' };
		}

		// Worker에 sync 명령 전송
		this.deps.sendCommand({ type: 'sync', scope });

		return { filesQueued: -1, trigger: `manual (${scope}, dispatched to worker)` };
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
