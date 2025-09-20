import type { WorkerPoolOptions } from './interfaces';
import type { ComlinkWorkerPool } from './types';
import { WorkerPool } from './worker-pool';

/**
 * Create a worker pool
 * @param options The options for the worker pool
 * @returns A ComlinkWorkerPool instance
 */
export function createWorkerPool<T>(options: WorkerPoolOptions) {
  const pool = new WorkerPool<T>(options);

  return new Proxy(pool, {
    get: (target, prop) => {
      const worker = target.acquire();

      return async (...args: any[]) => {
        const method = (worker as any)[prop];

        if (typeof method !== 'function') {
          throw new Error(`Method ${prop.toString()} not found on worker.`);
        }

        return await method(...args);
      };
    },
  }) as ComlinkWorkerPool<T>;
}
