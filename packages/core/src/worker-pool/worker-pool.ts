import { releaseProxy, wrap } from 'comlink';
import { backOff } from 'exponential-backoff';

import type { ClassProperties, MethodParams, MethodReturn } from '../common';

import type { BaseWorker } from './base-worker';
import type { WrappedWorker, WorkerPoolOptions } from './interfaces';
import { LoadBalancer } from './load-balancer';
import type { BootstrapParams, InitParams } from './types';

export class WorkerPool<T extends BaseWorker> {
  private readonly script: URL;
  private readonly reviving = new Set<number>();
  private readonly workers: Array<WrappedWorker<T> | undefined>;
  private readonly loadBalancer: LoadBalancer;
  private statsTimer: ReturnType<typeof setInterval> | undefined;
  private destroying = false;
  private initParams: InitParams<T>;
  private bootstrapParams: BootstrapParams<T>;

  constructor(options: WorkerPoolOptions) {
    const size = options?.size ?? navigator.hardwareConcurrency;

    this.script = options.script;
    this.loadBalancer = new LoadBalancer(size);
    this.workers = Array.from({ length: size }, (_, id) =>
      this.spawnWorker(id),
    );
  }

  /**
   * Destroy the worker pool and terminate all workers.
   * @param params Parameters to pass to each worker's destroy method.
   */
  async destroy() {
    this.destroying = true;

    if (this.statsTimer) {
      clearInterval(this.statsTimer);

      this.statsTimer = undefined;
    }

    await Promise.all(this.workers.map((_, id) => this.destroyWorker(id)));
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
    // TODO Worker 가 없을 경우 대응 필요
    const workerId = this.loadBalancer.acquire();
    const remote = this.workers[workerId]!.remote;

    try {
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
  async init(params: InitParams<T>) {
    this.initParams = params;

    await Promise.all(
      this.workers.map((worker, index) => worker?.remote.init(index, params)),
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
  async bootstrap(params: BootstrapParams<T>) {
    this.bootstrapParams = params;

    await Promise.all(
      this.workers.map(worker => worker?.remote.bootstrap(params)),
    );
  }

  private spawnWorker(id: number): WrappedWorker<T> {
    const native = new Worker(this.script.href);
    const onError = this.handleCrash('error', id).bind(this);
    const onMessageError = this.handleCrash('messageerror', id).bind(this);
    const onClose = this.handleCrash('close', id).bind(this);

    native.addEventListener('error', (e: unknown) => {
      void onError(e);
    });
    native.addEventListener('messageerror', (e: unknown) => {
      void onMessageError(e);
    });
    native.addEventListener('close', (e: unknown) => {
      void onClose(e);
    });

    return { remote: wrap<T>(native), native };
  }

  private handleCrash(event: 'error' | 'messageerror' | 'close', id: number) {
    return async (e: unknown) => {
      if (this.destroying) {
        return;
      }

      console.error(`💥 Worker #${id} ${event}: `, e);

      await this.destroyWorker(id).catch(() => {});

      this.workers[id] = undefined;

      this.reviveWorker(id);
    };
  }

  private reviveWorker(id: number) {
    if (this.destroying || this.reviving.has(id)) {
      return;
    }

    this.reviving.add(id);

    let attempt = 0;

    void backOff(
      async () => {
        if (this.destroying) {
          this.reviving.delete(id);

          throw new Error();
        }

        ++attempt;

        console.info(`🩺 Revive attempt ${attempt} for worker #${id}`);

        const worker = this.spawnWorker(id);

        await worker.remote.init(id, this.initParams as any);
        await worker.remote.bootstrap(this.bootstrapParams as any);

        this.workers[id] = worker;

        this.reviving.delete(id);
      },
      {
        numOfAttempts: 50,
        startingDelay: 300,
        maxDelay: 30_000,
        timeMultiple: 2,
        jitter: 'full',
        delayFirstAttempt: true,
        retry: () => !this.destroying,
      },
    ).catch(() => {
      this.reviving.delete(id);
    });
  }

  private async destroyWorker(id: number) {
    const worker = this.workers[id];

    if (!worker) {
      return;
    }

    this.reviving.delete(id);
    await worker.remote.destroy();
    worker.native.terminate();
    worker.remote[releaseProxy]();
  }

  private async collectWorkerStats() {
    await Promise.all(
      this.workers.map(async (worker, id) => {
        const stats = await worker?.remote.getStats().catch(() => null);

        if (!stats) {
          return;
        }

        this.loadBalancer.updateStats(id, stats);
      }),
    );
  }
}
