import { Logger } from '@bunner/logger';
import { backOff } from 'exponential-backoff'; // Consider removing if complex retry logic handles native restarts differently, but keeping for now.

import type { ClusterBaseWorker } from './cluster-base-worker';
import type { ClusterWorker, ClusterOptions } from './interfaces';
import { wrap } from './ipc';
import type { ClusterBootstrapParams, ClusterInitParams } from './types';

export class ClusterManager<T extends ClusterBaseWorker> {
  private readonly script: URL;
  private readonly reviving = new Set<number>();
  private readonly workers: Array<ClusterWorker<T> | undefined>;
  private readonly logger = new Logger(ClusterManager.name);
  private destroying = false;
  private initParams: ClusterInitParams<T>;
  private bootstrapParams: ClusterBootstrapParams<T>;

  constructor(options: ClusterOptions) {
    const size = options?.size ?? navigator.hardwareConcurrency;

    this.script = options.script;
    this.workers = Array.from({ length: size }, (_, id) => this.spawnWorker(id));
  }

  async destroy() {
    this.destroying = true;
    await Promise.all(this.workers.map((_, id) => this.destroyWorker(id)));
  }

  // 'call' method removed - no longer needed for native cluster

  async init(params?: ClusterInitParams<T>) {
    this.initParams = params;
    const tasks: Array<Promise<any>> = this.workers.map((worker, id) =>
      worker ? worker.remote.init(id, params) : Promise.resolve(),
    );
    await Promise.all(tasks);
  }

  async bootstrap(params?: ClusterBootstrapParams<T>) {
    this.bootstrapParams = params;
    const tasks: Array<Promise<any>> = this.workers.map(worker =>
      worker ? (worker.remote.bootstrap(params) as Promise<any>) : Promise.resolve(),
    );
    await Promise.all(tasks);
  }

  private spawnWorker(id: number): ClusterWorker<T> {
    const native = new Worker(this.script.href, {
      env: {
        ...process.env,
        BUNNER_WORKER_ID: id.toString(),
      },
      smol: true, // Optional: memory optimization
    });

    native.addEventListener('error', (e: unknown) => {
      void this.handleCrash('error', id, e);
    });
    native.addEventListener('messageerror', (e: unknown) => {
      void this.handleCrash('messageerror', id, e);
    });
    native.addEventListener('close', (e: unknown) => {
      void this.handleCrash('close', id, e);
    });

    return { remote: wrap<T>(native), native };
  }

  private async handleCrash(event: 'error' | 'messageerror' | 'close', id: number, e: unknown) {
    if (this.destroying) {
      return;
    }

    this.logger.error(`💥 Worker #${id} ${event}: `, e);

    await this.destroyWorker(id).catch(() => {});

    this.workers[id] = undefined;

    this.reviveWorker(id);
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

        this.logger.info(`🩺 Revive attempt ${attempt} for worker #${id}`);

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
    try {
      await worker.remote.destroy();
    } catch {} // Optional: if worker process kills itself, this might fail/timeout
    worker.native.terminate();
    // worker.remote[releaseProxy](); // No longer needed for native wrapper
  }
}
