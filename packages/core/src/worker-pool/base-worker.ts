import type { WorkerStats } from './interfaces';
import type { WorkerId, InitParams } from './types';

// Declare global WORKER_ID
declare global {
  var WORKER_ID: number | undefined;
}

export abstract class BaseWorker {
  protected prevCpu: ReturnType<typeof process.cpuUsage>;
  protected id: WorkerId;

  abstract bootstrap(params?: any): void | Promise<void>;

  abstract destroy(): void | Promise<void>;

  async init<T>(id: number, _params: InitParams<T>) {
    globalThis.WORKER_ID = id;
    this.id = id;
    this.prevCpu = process.cpuUsage();
    await Promise.resolve();
  }

  getStats() {
    const currentCpu = process.cpuUsage(this.prevCpu);
    const totalCpu = (currentCpu.user ?? 0) + (currentCpu.system ?? 0);

    this.prevCpu = process.cpuUsage();

    const stats: WorkerStats = {
      cpu: Math.max(0, Math.min(1, totalCpu / 1_000_000)),
      memory: process.memoryUsage().rss,
    };

    return stats;
  }
}
