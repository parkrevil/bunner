import { LoadBalancer } from './load-balancer';

export type WorkerPoolOptions = {
  size?: number;
};

export class WorkerPool {
  public readonly workerCount: number;
  private balancer: LoadBalancer;

  constructor(opts: WorkerPoolOptions = {}) {
    const cpuCount =
      (typeof navigator !== 'undefined' &&
        (navigator as any).hardwareConcurrency) ||
      1;
    const size = opts.size ?? cpuCount;

    this.workerCount = size;
    this.balancer = new LoadBalancer(size);
  }

  acquire(): number {
    return this.balancer.acquire();
  }

  release(id: number) {
    this.balancer.release(id);
  }

  /** Report processing time (ms) for a finished job on worker `id`. */
  reportProcessingTime(id: number, ms: number) {
    this.balancer.reportProcessingTime(id, ms);
  }

  /** Report current queue length for a worker (best-effort). */
  reportQueueLength(id: number, qlen: number) {
    this.balancer.reportQueueLength(id, qlen);
  }

  /** Report CPU usage (0..1 or 0..100) for a worker. */
  reportCpu(id: number, val: number) {
    this.balancer.reportCpu(id, val);
  }

  /** Report memory usage in bytes for a worker. */
  reportMemory(id: number, bytes: number) {
    this.balancer.reportMemory(id, bytes);
  }

  destroy() {
    // logical pool; nothing to terminate
  }
}
