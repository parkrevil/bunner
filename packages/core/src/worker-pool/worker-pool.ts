import { type Remote, wrap } from 'comlink';

import type { WorkerPoolOptions } from './interfaces';
import { LoadBalancer } from './load-balancer';

export class WorkerPool<T> {
  private readonly workers: Remote<T>[];
  private workerId: number;
  private loadBalancer: LoadBalancer;

  constructor(options: WorkerPoolOptions) {
    const size = options?.size ?? navigator.hardwareConcurrency;

    this.workerId = 0;
    this.loadBalancer = new LoadBalancer(size);
    this.workers = Array.from({ length: size }, () =>
      wrap(new Worker(options.script.href)),
    );
  }

  get worker() {
    return this.workers[this.loadBalancer.acquire()]!;
  }

  async init(params: any) {
    await Promise.all(
      this.workers.map(worker => (worker as any).init(++this.workerId, params)),
    );
  }

  async bootstrap() {
    await Promise.all(this.workers.map(worker => (worker as any).bootstrap()));
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
