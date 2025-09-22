import { type Remote, wrap } from 'comlink';

import type { BaseWorker } from './base-worker';
import type { WorkerPoolOptions } from './interfaces';
import { LoadBalancer } from './load-balancer';

export class WorkerPool<T extends BaseWorker> {
  private readonly workers: Remote<T>[];
  private readonly loadBalancer: LoadBalancer;
  private statsTimer: ReturnType<typeof setInterval> | undefined;

  constructor(options: WorkerPoolOptions) {
    const size = options?.workers ?? navigator.hardwareConcurrency;

    this.loadBalancer = new LoadBalancer(size);
    this.workers = Array.from({ length: size }, () =>
      wrap<T>(new Worker(options.script.href)),
    );
  }

  get worker() {
    return this.workers[this.loadBalancer.acquire()]!;
  }

  async init<T>(params?: T) {
    await Promise.all(
      this.workers.map(async (worker, index) => worker.init(index, params)),
    );

    if (!this.statsTimer) {
      this.statsTimer = setInterval(() => {
        void this.collectWorkerStats();
      }, 1_000);
    }
  }

  async bootstrap<T>(params?: T) {
    await Promise.all(this.workers.map(worker => worker.bootstrap(params)));
  }

  release(id: number) {
    this.loadBalancer.release(id);
  }

  destroy() {
    if (this.statsTimer) {
      clearInterval(this.statsTimer);

      this.statsTimer = undefined;
    }
  }

  private async collectWorkerStats() {
    await Promise.all(
      this.workers.map(async (worker, id) => {
        const stats = await worker.getStats().catch(() => null);

        if (!stats) {
          return;
        }

        this.loadBalancer.updateStats(id, stats);
      }),
    );
  }
}
