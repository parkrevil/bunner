import type { WorkerPool } from './worker-pool';

/**
 * Worker Pool Extended Type
 * @description Combines the WorkerPool with the methods of the worker type T.
 */
export type ComlinkWorkerPool<T> = WorkerPool<T> & T;
