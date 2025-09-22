import type { Remote } from 'comlink';

/**
 * Options for configuring a worker pool.
 */
export interface WorkerPoolOptions {
  script: URL;
  size: number;
}

export interface WrappedWorker<T> {
  remote: Remote<T>;
  native: Worker;
}

/**
 * Worker Slot
 * @description The slot interface for a worker in the pool
 */
export interface WorkerSlot {
  active: number;
  cpu: number;
  memory: number;
}

/**
 * Worker Stats
 * @description The stats interface for a worker
 */
export interface WorkerStats {
  cpu: number;
  memory: number;
}
