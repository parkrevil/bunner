import { wrap } from 'comlink';

import type {
  ClassProperties,
  MethodParams,
  MethodReturn,
  MethodSecondParam,
} from '../common';

import type { BaseWorker } from './base-worker';
import type { WrappedWorker, WorkerPoolOptions } from './interfaces';
import { LoadBalancer } from './load-balancer';

export class WorkerPool<T extends BaseWorker> {
  private readonly workers: WrappedWorker<T>[];
  private readonly loadBalancer: LoadBalancer;
  private statsTimer: ReturnType<typeof setInterval> | undefined;

  constructor(options: WorkerPoolOptions) {
    const size = options?.size ?? navigator.hardwareConcurrency;

    this.loadBalancer = new LoadBalancer(size);
    this.workers = Array.from({ length: size }, () => {
      const worker = new Worker(options.script.href);

      return {
        remote: wrap<T>(worker),
        native: worker,
      };
    });
  }

  /**
   * Call a method on a worker from the pool.
   * @param method The method name to call.
   * @param args Arguments to pass to the method.
   * @returns The result of the method call.
   */
  call<K extends ClassProperties<T>>(
    method: K,
    ...args: MethodParams<T, K>
  ): Promise<Awaited<MethodReturn<T, K>>> {
    const workerId = this.loadBalancer.acquire();
    const remote = this.workers[workerId]!.remote;

    try {
      this.loadBalancer.increaseActive(workerId);

      const fn = remote[method] as unknown as (
        ...args: MethodParams<T, K>
      ) => Promise<Awaited<MethodReturn<T, K>>>;

      return fn(...args);
    } finally {
      this.loadBalancer.decreaseActive(workerId);
    }
  }

  /**
   * Initialize the worker pool.
   * @param params Parameters to pass to each worker's init method.
   */
  async init(
    params?: MethodSecondParam<T, Extract<'init', ClassProperties<T>>>,
  ) {
    await Promise.all(
      this.workers.map((worker, index) => worker.remote.init(index, params)),
    );

    if (!this.statsTimer) {
      this.statsTimer = setInterval(() => {
        void this.collectWorkerStats();
      }, 1_000);
    }
  }

  /**
   * Bootstrap the worker pool.
   * @param params Parameters to pass to each worker's bootstrap method.
   */
  async bootstrap(
    params?: MethodParams<T, Extract<'bootstrap', ClassProperties<T>>>[0],
  ) {
    await Promise.all(
      this.workers.map(worker => worker.remote.bootstrap(params)),
    );
  }

  /**
   * Destroy the worker pool and terminate all workers.
   * @param params Parameters to pass to each worker's destroy method.
   */
  async destroy() {
    if (this.statsTimer) {
      clearInterval(this.statsTimer);

      this.statsTimer = undefined;
    }

    await Promise.all(
      this.workers.map(async worker => {
        await worker.remote.destroy();
        worker.native.terminate();
      }),
    );
  }

  private async collectWorkerStats() {
    await Promise.all(
      this.workers.map(async (worker, id) => {
        const stats = await worker.remote.getStats().catch(() => null);

        if (!stats) {
          return;
        }

        this.loadBalancer.updateStats(id, stats);
      }),
    );
  }
}
