export type WorkerSlot = {
  id: number;
  // currently active jobs
  active: number;
  // moving-average of processing time in ms
  avgProcessingMs: number;
  // queue length observed (best-effort)
  queueLength: number;
  // EMA-normalized CPU estimate 0..1 (worker-reported or estimated)
  cpu: number;
  // EMA-normalized memory usage 0..1
  memory: number;
};

type InternalSlot = WorkerSlot;

export class LoadBalancer {
  private slots: InternalSlot[];
  // EMA smoothing factor for processing time / memory / cpu / error
  private readonly alpha = 0.15;
  // small epsilon to avoid division by zero
  private readonly eps = 1e-6;
  // configured soft limits for normalization (can be tuned)
  private memorySoftLimit = 256 * 1024 * 1024; // 256MB default

  constructor(workerCount: number) {
    this.slots = new Array(workerCount).fill(0).map((_, i) => ({
      id: i,
      active: 0,
      avgProcessingMs: 0,
      queueLength: 0,
      cpu: 0,
      memory: 0,
    }));
  }

  /** Acquire the best worker index and increment its active count. */
  acquire(): number {
    if (this.slots.length === 0) {
      throw new Error('no worker slots');
    }

    // compute scores and pick lowest
    const first = this.slots[0]!;
    let best: InternalSlot = first;
    let bestScore = this.scoreSlot(best);

    for (let i = 1; i < this.slots.length; i++) {
      const slot = this.slots[i]!;
      const s = this.scoreSlot(slot);
      if (s < bestScore) {
        best = slot;
        bestScore = s;
      }
    }

    best.active++;
    return best.id;
  }

  /** Release a worker slot by index (decrement active count). */
  release(id: number) {
    const slot = this.slots[id];
    if (!slot) {
      return;
    }
    slot.active = Math.max(0, slot.active - 1);
  }

  /** Worker reports a finished processing time (ms) to update EMA. */
  reportProcessingTime(id: number, processingMs: number) {
    const slot = this.slots[id];
    if (!slot) {
      return;
    }
    if (slot.avgProcessingMs <= 0) {
      slot.avgProcessingMs = processingMs;
    } else {
      slot.avgProcessingMs =
        this.alpha * processingMs + (1 - this.alpha) * slot.avgProcessingMs;
    }
  }

  /** Worker reports its queue length (best-effort sample). */
  reportQueueLength(id: number, qlen: number) {
    const slot = this.slots[id];
    if (!slot) {
      return;
    }
    slot.queueLength = qlen;
  }

  /** Worker reports CPU usage as normalized 0..1 (or 0..100 if provided). */
  reportCpu(id: number, cpuNormalized: number) {
    const slot = this.slots[id];
    if (!slot) {
      return;
    }
    // accept 0..100 or 0..1
    let val = cpuNormalized;
    if (val > 1) {
      val = Math.min(100, val) / 100;
    }
    slot.cpu = this.alpha * val + (1 - this.alpha) * slot.cpu;
  }

  /** Worker reports memory usage in bytes; will be normalized by soft limit. */
  reportMemory(id: number, bytes: number) {
    const slot = this.slots[id];
    if (!slot) {
      return;
    }
    const normalized = Math.min(1, bytes / Math.max(this.memorySoftLimit, 1));
    slot.memory = this.alpha * normalized + (1 - this.alpha) * slot.memory;
  }

  /** Optionally tune soft limits for normalization. */
  setMemorySoftLimit(bytes: number) {
    this.memorySoftLimit = Math.max(1, bytes);
  }

  /** Directly set active count (careful). */
  setActive(id: number, active: number) {
    const slot = this.slots[id];
    if (!slot) {
      return;
    }
    slot.active = Math.max(0, active);
  }

  getLoads(): WorkerSlot[] {
    return this.slots.map(s => ({
      id: s.id,
      active: s.active,
      avgProcessingMs: s.avgProcessingMs,
      queueLength: s.queueLength,
      cpu: s.cpu,
      memory: s.memory,
    }));
  }

  /** Compute a composite score for a slot. Lower is better. */
  private scoreSlot(slot: InternalSlot) {
    // normalize metrics to 0..1
    const activeNorm = slot.active / (slot.active + 1 + this.eps); // 0..~1
    const procNorm = Math.min(1, slot.avgProcessingMs / (1000 + this.eps)); // assumes 1s is large
    const queueNorm = Math.min(1, slot.queueLength / (50 + this.eps)); // 50 queued is heavy
    const cpuNorm = Math.max(0, Math.min(1, slot.cpu));
    const memNorm = Math.max(0, Math.min(1, slot.memory));

    // weights tuned for memory replacing errorRate
    const w_active = 0.3;
    const w_proc = 0.25;
    const w_cpu = 0.15;
    const w_queue = 0.1;
    const w_mem = 0.2;

    return (
      w_active * activeNorm +
      w_proc * procNorm +
      w_cpu * cpuNorm +
      w_queue * queueNorm +
      w_mem * memNorm
    );
  }
}
