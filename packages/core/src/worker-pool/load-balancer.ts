import type { WorkerSlot } from './interfaces';

export class LoadBalancer {
  private readonly alpha: number;
  private readonly eps: number;
  private readonly memoryLimit: number;
  private readonly responseTimeLimit: number;
  private slots: Array<WorkerSlot | undefined>;
  private weights: WorkerSlot;

  constructor(count: number) {
    this.alpha = 0.2;
    this.eps = 1e-6;
    this.memoryLimit = 512 * 1024 * 1024;
    this.responseTimeLimit = 1_000;
    this.weights = {
      active: 0.7,
      cpu: 0.2,
      memory: 0.05,
      responseTime: 0.05,
    };
    this.slots = Array.from({ length: count }, () => ({
      active: 0,
      cpu: 0,
      memory: 0,
      responseTime: 0,
    }));
  }

  addSlot(id: number) {
    this.slots[id] = {
      active: 0,
      cpu: 0,
      memory: 0,
      responseTime: 0,
    };
  }

  deleteSlot(id: number) {
    this.slots[id] = undefined;
  }

  acquire() {
    let bestSlot: number | undefined;
    let bestScore = Infinity;

    this.slots.forEach((slot, id) => {
      if (!slot) {
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

  updateStats(id: number, stats: Omit<WorkerSlot, 'active'>) {
    const slot = this.slots[id];

    if (!slot) {
      return;
    }

    let { cpu, memory, responseTime } = stats;

    if (cpu > 1) {
      cpu = Math.min(100, cpu) / 100;
    }

    slot.cpu = this.alpha * cpu + (1 - this.alpha) * slot.cpu;

    memory = Math.min(1, memory / Math.max(this.memoryLimit, 1));
    slot.memory = this.alpha * memory + (1 - this.alpha) * slot.memory;

    responseTime = Math.min(
      1,
      responseTime / Math.max(this.responseTimeLimit, 1),
    );
    slot.responseTime =
      this.alpha * responseTime + (1 - this.alpha) * slot.responseTime;
  }

  private getScore(slot: WorkerSlot | undefined) {
    if (!slot) {
      return Infinity;
    }

    const active = slot.active / (slot.active + 1 + this.eps);
    const cpu = Math.max(0, Math.min(1, slot.cpu));
    const memory = Math.max(0, Math.min(1, slot.memory));
    const responseTime = Math.max(0, Math.min(1, slot.responseTime));

    return (
      this.weights.active * active +
      this.weights.cpu * cpu +
      this.weights.memory * memory +
      this.weights.responseTime * responseTime
    );
  }
}
