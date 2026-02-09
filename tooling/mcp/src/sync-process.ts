/**
 * Sync Process — Bun subprocess entrypoint.
 *
 * 메인 프로세스(MCP 서버)와 **완전히 격리된 별도 프로세스**에서 실행.
 * Bun.spawn IPC로 통신. I/O 리소스 완전 분리.
 *
 * IPC 프로토콜: sync-ipc.ts 참조.
 *
 * 실행:
 *   Parent: Bun.spawn(["bun", "sync-process.ts"], { ipc(msg) { ... } })
 *   Child:  process.on("message") / process.send()
 *
 * 흐름:
 *   1. Parent → { type: 'init', env } 수신
 *   2. 독립 DB 풀 + SyncWorker + FileWatcher 초기화
 *   3. Child → { type: 'ready' } 전송
 *   4. 이후 Parent → enqueue/sync/stop, Child → status 보고
 */

function formatUnknownError(value: unknown): { message: string; stack?: string } {
	if (value instanceof Error) {
		return value.stack
			? { message: value.message, stack: value.stack }
			: { message: value.message };
	}
	return { message: String(value) };
}

function trySendFatal(detail: string): void {
	try {
		process.send?.({ type: 'error', detail } as any);
	} catch {
		// ignore
	}
}

process.on('uncaughtException', (err) => {
	const { message, stack } = formatUnknownError(err);
	const detail = `[FATAL] uncaughtException: ${message}${stack ? `\n${stack}` : ''}`;
	trySendFatal(detail);
	// stdout는 MCP transport가 사용하므로 stderr로만 출력
	process.stderr.write(`${detail}\n`);
	process.exit(1);
});

process.on('unhandledRejection', (reason) => {
	const { message, stack } = formatUnknownError(reason);
	const detail = `[FATAL] unhandledRejection: ${message}${stack ? `\n${stack}` : ''}`;
	trySendFatal(detail);
	process.stderr.write(`${detail}\n`);
	process.exit(1);
});

import { createDb, type Db } from './db';
import { SyncQueue } from './sync-queue';
import { SyncWorker } from './sync-worker';
import { HashCache } from './hash-cache';
import { FileWatcher } from './watcher';
import { createDefaultRegistry } from './parsers';
import type { KBConfig } from './config';
import type {
	SyncCommand,
	SyncEvent,
	SyncWorkerEnv,
	SyncWorkerStatus,
} from './sync-ipc';
import { SYNC_CHUNK_SIZE, SYNC_YIELD_MS } from './sync-ipc';

// ── State ────────────────────────────────────────────────────

let db: Db | null = null;
let queue: SyncQueue | null = null;
let hashCache: HashCache | null = null;
let worker: SyncWorker | null = null;
let watcher: FileWatcher | null = null;
let config: KBConfig | null = null;
let repoRoot = '';
let statusInterval: ReturnType<typeof setInterval> | null = null;
let filesProcessed = 0;

// ── Helpers ──────────────────────────────────────────────────

function send(event: SyncEvent): void {
	process.send!(event);
}

function sendLog(
	level: 'debug' | 'info' | 'warn' | 'error',
	module: string,
	message: string,
	extra?: Record<string, unknown>,
): void {
	const event: SyncEvent = extra
		? { type: 'log', level, module, message, extra }
		: { type: 'log', level, module, message };
	send(event);
}

function sendStatus(): void {
	if (!worker || !queue || !hashCache || !watcher) return;
	const status: SyncWorkerStatus = {
		workerStatus: worker.status,
		queueDepth: queue.depth,
		lastSyncAt: worker.lastSyncAt?.toISOString() ?? null,
		lastSyncDurationMs: worker.lastSyncDurationMs,
		startupScanComplete: worker.startupScanComplete,
		filesProcessed,
		hashCacheSize: hashCache.size,
		watchHealthy: watcher.healthy,
		watchedDirs: watcher.watchedDirs,
	};
	send({ type: 'status', status });
}

// ── Init ─────────────────────────────────────────────────────

async function init(env: SyncWorkerEnv): Promise<void> {
	try {
		const initStart = Date.now();
		sendLog('info', 'sync-process', 'Init start', {
			workspaceId: env.workspaceId,
			repoRoot: env.repoRoot,
		});

		// 1. DB 풀 (별도 프로세스 — 완전 독립)
		const tDbStart = Date.now();
		try {
			const url = new URL(env.databaseUrl);
			const database = url.pathname.startsWith('/') ? url.pathname.slice(1) : url.pathname;
			sendLog('info', 'sync-process', 'DB connect start', {
				primary: {
					protocol: url.protocol,
					host: url.hostname,
					port: url.port,
					database,
					user: url.username ? decodeURIComponent(url.username) : undefined,
					hasPassword: Boolean(url.password),
				},
				pool: env.pool,
			});
		} catch (err) {
			sendLog('warn', 'sync-process', 'DB url parse failed', {
				error: err instanceof Error ? err.message : String(err),
			});
		}
		db = await createDb(env.databaseUrl, env.pool);
		sendLog('info', 'sync-process', 'DB connect ready', { durationMs: Date.now() - tDbStart });

		// 2. Config
		const tConfigStart = Date.now();
		config = env.config;
		repoRoot = env.repoRoot;
		sendLog('info', 'sync-process', 'Config ready', { durationMs: Date.now() - tConfigStart });

		// 3. Infrastructure
		const tInfraStart = Date.now();
		queue = new SyncQueue();
		hashCache = new HashCache();
		const registry = createDefaultRegistry();
		sendLog('info', 'sync-process', 'Infrastructure ready', { durationMs: Date.now() - tInfraStart });

		// 4. FileWatcher (별도 프로세스 내에서 직접 watch)
		const tWatcherStart = Date.now();
		watcher = new FileWatcher({ queue, hashCache, config, repoRoot });
		watcher.start();
		sendLog('info', 'sync-process', 'Watcher started', { durationMs: Date.now() - tWatcherStart });

		// 5. SyncWorker
		const tWorkerCreateStart = Date.now();
		worker = new SyncWorker({
			db,
			queue,
			hashCache,
			config,
			registry,
			workspaceId: env.workspaceId,
			repoRoot,
		});
		sendLog('info', 'sync-process', 'Worker created', { durationMs: Date.now() - tWorkerCreateStart });

		// 6. 주기적 상태 보고 (1초 간격)
		statusInterval = setInterval(sendStatus, 1000);

		// 7. SyncWorker 시작
		void worker.start().catch((err: unknown) => {
			send({ type: 'error', detail: `SyncWorker start failed: ${err instanceof Error ? err.message : String(err)}` });
		});

		send({ type: 'ready' });
		sendLog('info', 'sync-process', 'Sync subprocess initialized', {
			durationMs: Date.now() - initStart,
			workspaceId: env.workspaceId,
			repoRoot,
		});
	} catch (err) {
		send({ type: 'error', detail: `Init failed: ${err instanceof Error ? err.message : String(err)}` });
	}
}

// ── Command Handler (IPC from parent process) ────────────────

process.on('message', async (cmd: SyncCommand) => {
	switch (cmd.type) {
		case 'init':
			await init(cmd.env);
			break;

		case 'enqueue':
			if (queue) {
				queue.enqueueBatch(cmd.files, cmd.trigger);
			}
			break;

		case 'sync': {
			if (!queue || !config) break;
			try {
				const { scanFiles } = await import('./scanner');
				const scanned = await scanFiles(repoRoot, config);
				const filePaths = scanned.map((f) => f.filePath);

				for (let i = 0; i < filePaths.length; i += SYNC_CHUNK_SIZE) {
					const chunk = filePaths.slice(i, i + SYNC_CHUNK_SIZE);
					queue.enqueueBatch(chunk, 'manual');
					if (SYNC_YIELD_MS > 0) {
						await Bun.sleep(SYNC_YIELD_MS);
					} else {
						await new Promise<void>((r) => setTimeout(r, 0));
					}
				}

				sendLog('info', 'sync-process', `Sync triggered: ${filePaths.length} files queued`, { scope: cmd.scope });
			} catch (err) {
				send({ type: 'error', detail: `Sync scan failed: ${err instanceof Error ? err.message : String(err)}` });
			}
			break;
		}

		case 'stop':
			if (worker) worker.stop();
			if (watcher) watcher.stop();
			if (statusInterval) clearInterval(statusInterval);
			if (db) await db.close();
			sendLog('info', 'sync-process', 'Sync subprocess stopped');
			process.exit(0);
			break;
	}
});
