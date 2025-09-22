import type { WorkerStats, WorkerSlot } from './interfaces';

export class LoadBalancer {
  private readonly alpha = 0.15;
  private readonly eps = 1e-6;
  private readonly memoryLimit = 256 * 1024 * 1024;
  private slots: WorkerSlot[];
  private weights = {
    active: 0.3,
    cpu: 0.15,
    mem: 0.2,
  };

  constructor(workerCount: number) {
    this.slots = Array.from({ length: workerCount }, (_, index) => ({
      id: index,
      active: 0,
      cpu: 0,
      memory: 0,
    }));
  }

  acquire() {
    if (this.slots.length === 0) {
      throw new Error('no worker slots');
    }

    let bestSlot = this.slots[0]!;
    let bestScore = this.getSlotScore(bestSlot);

    for (let i = 1; i < this.slots.length; i++) {
      const slot = this.slots[i]!;
      const score = this.getSlotScore(slot);

      if (score < bestScore) {
        bestSlot = slot;
        bestScore = score;
      }
    }

    bestSlot.active++;

    return bestSlot.id;
  }

  release(id: number) {
    const slot = this.slots[id];

    if (!slot) {
      return;
    }

    slot.active = Math.max(0, slot.active - 1);
  }

  updateStats(id: number, stats: WorkerStats) {
    const slot = this.slots[id];

    if (!slot) {
      return;
    }

    let { cpu, memory } = stats;

    if (cpu > 1) {
      cpu = Math.min(100, cpu) / 100;
    }

    slot.cpu = this.alpha * cpu + (1 - this.alpha) * slot.cpu;

    memory = Math.min(1, memory / Math.max(this.memoryLimit, 1));
    slot.memory = this.alpha * memory + (1 - this.alpha) * slot.memory;
  }

  private getSlotScore(slot: WorkerSlot) {
    const active = slot.active / (slot.active + 1 + this.eps);
    const cpu = Math.max(0, Math.min(1, slot.cpu));
    const mem = Math.max(0, Math.min(1, slot.memory));

    return (
      this.weights.active * active +
      this.weights.cpu * cpu +
      this.weights.mem * mem
    );
  }
}
