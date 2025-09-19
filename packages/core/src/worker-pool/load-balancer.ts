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
  // adaptive weight tuning
  private weights = {
    active: 0.3,
    proc: 0.25,
    cpu: 0.15,
    queue: 0.1,
    mem: 0.2,
  };
  private lastTuneAt = 0;
  private readonly tuneIntervalMs = 1000; // minimum interval between auto-tunes
  private readonly tuneAlpha = 0.2; // smoothing when updating weights

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

  /** Worker reports a finished job duration (ms) to update EMA. */
  reportJobDuration(id: number, durationMs: number) {
    const slot = this.slots[id];
    if (!slot) {
      return;
    }
    if (slot.avgProcessingMs <= 0) {
      slot.avgProcessingMs = durationMs;
    } else {
      slot.avgProcessingMs =
        this.alpha * durationMs + (1 - this.alpha) * slot.avgProcessingMs;
    }

    // attempt to auto-tune weights occasionally
    const now = Date.now();
    if (now - this.lastTuneAt >= this.tuneIntervalMs) {
      this.adjustWeightsAutomatically();
      this.lastTuneAt = now;
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
  reportCpuUsage(id: number, cpuNormalized: number) {
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
  reportMemoryUsage(id: number, bytes: number) {
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

  getWorkerStats(): WorkerSlot[] {
    return this.slots.map(s => ({
      id: s.id,
      active: s.active,
      avgProcessingMs: s.avgProcessingMs,
      queueLength: s.queueLength,
      cpu: s.cpu,
      memory: s.memory,
    }));
  }

  /** Expose current adaptive weights for debugging. */
  getAdaptiveWeights() {
    return { ...this.weights };
  }

  /** Adjust weights automatically by measuring covariance between each metric and avgProcessingMs. */
  private adjustWeightsAutomatically() {
    const n = this.slots.length;
    if (n < 2) {
      return;
    } // nothing to learn from

    // collect sample vectors
    const processingTimes = this.slots.map(s => s.avgProcessingMs || 0);
    const activeFractions = this.slots.map(
      s => s.active / (s.active + 1 + this.eps),
    );
    const cpuValues = this.slots.map(s => s.cpu);
    const queueFractions = this.slots.map(s =>
      Math.min(1, s.queueLength / (50 + this.eps)),
    );
    const memoryValues = this.slots.map(s => s.memory);

    const mean = (arr: number[]) =>
      arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;

    const cov = (a: number[], b: number[]) => {
      if (a.length === 0 || b.length === 0) {
        return 0;
      }
      const ma = mean(a);
      const mb = mean(b);
      let s = 0;
      for (let i = 0; i < a.length; i++) {
        const ai = a[i] ?? 0;
        const bi = b[i] ?? 0;
        s += (ai - ma) * (bi - mb);
      }
      return s / a.length;
    };

    const covActive = cov(activeFractions, processingTimes);
    const covProc = cov(processingTimes, processingTimes); // variance of processing time
    const covCpu = cov(cpuValues, processingTimes);
    const covQueue = cov(queueFractions, processingTimes);
    const covMem = cov(memoryValues, processingTimes);

    // use only positive covariances as signals
    const raw = {
      active: Math.max(0, covActive),
      proc: Math.max(0, covProc),
      cpu: Math.max(0, covCpu),
      queue: Math.max(0, covQueue),
      mem: Math.max(0, covMem),
    };

    const sumRaw = raw.active + raw.proc + raw.cpu + raw.queue + raw.mem;
    if (sumRaw <= 0) {
      return;
    } // no positive signal

    // normalize and smooth
    const newWeights: {
      active: number;
      proc: number;
      cpu: number;
      queue: number;
      mem: number;
    } = {
      active: raw.active / sumRaw,
      proc: raw.proc / sumRaw,
      cpu: raw.cpu / sumRaw,
      queue: raw.queue / sumRaw,
      mem: raw.mem / sumRaw,
    };

    // smooth update
    this.weights.active =
      this.tuneAlpha * newWeights.active +
      (1 - this.tuneAlpha) * this.weights.active;
    this.weights.proc =
      this.tuneAlpha * newWeights.proc +
      (1 - this.tuneAlpha) * this.weights.proc;
    this.weights.cpu =
      this.tuneAlpha * newWeights.cpu + (1 - this.tuneAlpha) * this.weights.cpu;
    this.weights.queue =
      this.tuneAlpha * newWeights.queue +
      (1 - this.tuneAlpha) * this.weights.queue;
    this.weights.mem =
      this.tuneAlpha * newWeights.mem + (1 - this.tuneAlpha) * this.weights.mem;
  }

  /** Compute a composite score for a slot. Lower is better. */
  private scoreSlot(slot: InternalSlot) {
    // normalize metrics to 0..1
    const activeNorm = slot.active / (slot.active + 1 + this.eps); // 0..~1
    const procNorm = Math.min(1, slot.avgProcessingMs / (1000 + this.eps)); // assumes 1s is large
    const queueNorm = Math.min(1, slot.queueLength / (50 + this.eps)); // 50 queued is heavy
    const cpuNorm = Math.max(0, Math.min(1, slot.cpu));
    const memNorm = Math.max(0, Math.min(1, slot.memory));

    // use adaptive weights
    const {
      active: w_active,
      proc: w_proc,
      cpu: w_cpu,
      queue: w_queue,
      mem: w_mem,
    } = this.weights;

    return (
      w_active * activeNorm +
      w_proc * procNorm +
      w_cpu * cpuNorm +
      w_queue * queueNorm +
      w_mem * memNorm
    );
  }
}
