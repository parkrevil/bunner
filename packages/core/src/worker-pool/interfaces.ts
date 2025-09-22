/**
 * Options for configuring a worker pool.
 */
export interface WorkerPoolOptions {
  script: URL;
  workers?: number;
}

/**
 * Worker Slot
 * @description The slot interface for a worker in the pool
 */
export interface WorkerSlot {
  id: number;
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
