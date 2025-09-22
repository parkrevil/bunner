import { wrap } from 'comlink';

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

  get worker() {
    return this.workers[this.loadBalancer.acquire()]!.remote;
  }

  async init<T>(params?: T) {
    await Promise.all(
      this.workers.map((worker, index) => worker.remote.init(index, params)),
    );

    if (!this.statsTimer) {
      this.statsTimer = setInterval(() => {
        void this.collectWorkerStats();
      }, 1_000);
    }
  }

  async bootstrap<T>(params?: T) {
    await Promise.all(
      this.workers.map(worker => worker.remote.bootstrap(params)),
    );
  }

  release(id: number) {
    this.loadBalancer.release(id);
  }

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
