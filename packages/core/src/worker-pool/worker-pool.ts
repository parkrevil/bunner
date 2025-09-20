import type { WorkerPoolOptions } from './interfaces';
import { LoadBalancer } from './load-balancer';

export class WorkerPool {
  public readonly size: number;
  public readonly workers: Worker[];
  private loadBalancer: LoadBalancer;

  constructor(options: WorkerPoolOptions) {
    this.size = options?.size ?? navigator.hardwareConcurrency;
    this.loadBalancer = new LoadBalancer(this.size);

    for (let index = 0; index < this.size; index++) {
      const worker = new Worker(options.scripts);

      this.workers.push(worker);
    }
  }

  acquire(): number {
    return this.loadBalancer.acquire();
  }

  release(id: number) {
    this.loadBalancer.release(id);
  }

  /** Report processing time (ms) for a finished job on worker `id`. */
  reportJobDuration(id: number, ms: number) {
    this.loadBalancer.reportJobDuration(id, ms);
  }

  /** Report current queue length for a worker (best-effort). */
  reportQueueLength(id: number, qlen: number) {
    this.loadBalancer.reportQueueLength(id, qlen);
  }

  /** Report CPU usage (0..1 or 0..100) for a worker. */
  reportCpuUsage(id: number, val: number) {
    this.loadBalancer.reportCpuUsage(id, val);
  }

  /** Report memory usage in bytes for a worker. */
  reportMemoryUsage(id: number, bytes: number) {
    this.loadBalancer.reportMemoryUsage(id, bytes);
  }

  destroy() {
    // logical pool; nothing to terminate
  }
}
