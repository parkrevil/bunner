import type { WorkerStats } from './interfaces';
import type { WorkerId } from './types';

export abstract class BaseWorker {
  protected prevCpu: ReturnType<typeof process.cpuUsage>;
  protected id: WorkerId;

  constructor() {
    this.prevCpu = process.cpuUsage();
  }

  abstract init(workerId: WorkerId, params: any): void | Promise<void>;

  abstract bootstrap(params: any): void | Promise<void>;

  abstract destroy(): void | Promise<void>;

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
