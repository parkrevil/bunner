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

  destroy() {
    // logical pool; nothing to terminate
  }
}

export default WorkerPool;
