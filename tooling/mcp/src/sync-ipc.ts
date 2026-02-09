/**
 * Sync Worker IPC Protocol — Main ↔ Worker 스레드 간 메시지 정의.
 *
 * Main → Worker: 명령 (sync 트리거, 중지, 파일 변경 알림)
 * Worker → Main: 상태 보고 (status, queueDepth, 에러 등)
 *
 * Bun Worker의 postMessage는 structured clone을 사용하므로
 * 모든 메시지는 JSON-직렬화 가능해야 한다.
 */

import type { KBConfig } from './config';

// ── Main → Worker ────────────────────────────────────────────

export type SyncCommand =
	| { type: 'init'; env: SyncWorkerEnv }
	| { type: 'enqueue'; files: string[]; trigger: 'watch' | 'manual' | 'read_through' }
	| { type: 'sync'; scope: 'full' | 'changed' }
	| { type: 'stop' };

/**
 * Worker 초기화에 필요한 환경 정보 (structured clone 가능한 값만).
 * KBConfig는 순수 데이터 객체이므로 그대로 전달 가능.
 */
export type SyncWorkerEnv = {
	databaseUrl: string;
	pool: {
		max: number;
		idleTimeoutSec: number;
		connectionTimeoutSec: number;
		maxLifetimeSec: number;
	};
	workspaceId: string;
	repoRoot: string;
	config: KBConfig;
};

// ── Worker → Main ────────────────────────────────────────────

export type SyncEvent =
	| { type: 'ready' }
	| { type: 'status'; status: SyncWorkerStatus }
	| { type: 'error'; detail: string }
	| { type: 'log'; level: 'debug' | 'info' | 'warn' | 'error'; module: string; message: string; extra?: Record<string, unknown> };

export type SyncWorkerStatus = {
	workerStatus: 'idle' | 'running' | 'stopped';
	queueDepth: number;
	lastSyncAt: string | null;
	lastSyncDurationMs: number;
	startupScanComplete: boolean;
	filesProcessed: number;
	/** Worker 내 hash cache 사이즈 */
	hashCacheSize: number;
	/** FileWatcher 상태 */
	watchHealthy: boolean;
	watchedDirs: string[];
};

// ── Chunk 설정 ───────────────────────────────────────────────

/** startup scan 시 chunk 사이에 yield하는 배치 크기 */
export const SYNC_CHUNK_SIZE = 10;

/** chunk 사이 yield 시간 (ms). 0 = microtask yield */
export const SYNC_YIELD_MS = 0;
