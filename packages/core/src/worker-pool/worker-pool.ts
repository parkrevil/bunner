export type WorkerPoolOptions = {
  /** Worker module path (required) */
  script: string;
  /** Number of workers to spawn. Defaults to CPU count. */
  size?: number;
};

export class WorkerPool {
  public readonly workers: Worker[] = [];

  constructor(opts: WorkerPoolOptions) {
    const cpuCount =
      (typeof navigator !== 'undefined' &&
        (navigator as any).hardwareConcurrency) ||
      1;

    const size = opts.size ?? cpuCount;

    for (let i = 0; i < size; i++) {
      const w = new Worker(opts.script, { type: 'module' });
      this.workers.push(w);
    }
  }

  destroy() {
    for (const w of this.workers) {
      w.terminate();
    }

    this.workers.length = 0;
  }
}

export default WorkerPool;
