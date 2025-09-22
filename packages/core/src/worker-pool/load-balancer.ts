import { BunnerError } from '../errors';

import type { WorkerStats, WorkerSlot } from './interfaces';

export class LoadBalancer {
  private readonly alpha = 0.2;
  private readonly eps = 1e-6;
  private readonly memoryLimit = 512 * 1024 * 1024;
  private slots: Array<WorkerSlot | undefined>;
  private weights = {
    active: 0.7,
    cpu: 0.25,
    mem: 0.05,
  };

  constructor(count: number) {
    this.slots = Array.from({ length: count }, () => ({
      active: 0,
      cpu: 0,
      memory: 0,
    }));
  }

  addSlot(id: number) {
    this.slots[id] = {
      active: 0,
      cpu: 0,
      memory: 0,
    };
  }

  deleteSlot(id: number) {
    this.slots[id] = undefined;
  }

  acquire() {
    const slots = this.slots.filter(Boolean);

    if (!slots.length) {
      throw new BunnerError('no worker slots');
    }

    let bestSlot: number | undefined;
    let bestScore: number;

    slots.forEach((slot, id) => {
      if (bestSlot === undefined) {
        bestSlot = id;
        bestScore = this.getScore(slot);

        return;
      }

      const score = this.getScore(slot);

      if (score < bestScore) {
        bestSlot = id;
        bestScore = score;
      }
    });

    return bestSlot;
  }

  increaseActive(id: number) {
    if (!this.slots[id]) {
      return;
    }

    this.slots[id].active++;
  }

  decreaseActive(id: number) {
    if (!this.slots[id]) {
      return;
    }

    this.slots[id].active = Math.max(0, this.slots[id].active - 1);
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

  private getScore(slot: WorkerSlot | undefined) {
    if (!slot) {
      return Infinity;
    }

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
