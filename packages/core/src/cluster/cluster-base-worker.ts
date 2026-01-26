import type { ClusterWorkerStats } from './interfaces';
import type { ClusterBootstrapParams, ClusterInitParams, ClusterWorkerId } from './types';

export abstract class ClusterBaseWorker {
  protected prevCpu: ReturnType<typeof process.cpuUsage>;
  protected id: ClusterWorkerId;

  abstract bootstrap<T>(params?: ClusterBootstrapParams<T>): void | Promise<void>;

  abstract destroy(): void | Promise<void>;

  async init<T>(id: number, _params: ClusterInitParams<T>) {
    this.id = id;
    this.prevCpu = process.cpuUsage();

    await Promise.resolve();
  }

  getStats() {
    const currentCpu = process.cpuUsage(this.prevCpu);
    const totalCpu = (currentCpu.user ?? 0) + (currentCpu.system ?? 0);

    this.prevCpu = process.cpuUsage();

    const stats: ClusterWorkerStats = {
      cpu: Math.max(0, Math.min(1, totalCpu / 1_000_000)),
      memory: process.memoryUsage().rss,
    };

    return stats;
  }
}
