export type WorkerSlot = {
  id: number;
  active: number;
};

export class LeastLoadBalancer {
  private slots: WorkerSlot[];

  constructor(workerCount: number) {
    this.slots = new Array(workerCount)
      .fill(0)
      .map((_, i) => ({ id: i, active: 0 }));
  }

  /** Acquire the least-loaded worker index and increment its active count. */
  acquire(): number {
    if (this.slots.length === 0) {
      throw new Error('no worker slots');
    }

    let best = this.slots[0];
    for (let i = 1; i < this.slots.length; i++) {
      const slot = this.slots[i];
      if (slot.active < best.active) {
        best = slot;
      }
    }

    best.active++;
    return best.id;
  }

  /** Release a worker slot by index (decrement active count, floor at 0). */
  release(id: number) {
    const slot = this.slots[id];
    if (!slot) {
      return;
    }
    slot.active = Math.max(0, slot.active - 1);
  }

  /** Update a worker's active count directly. */
  setActive(id: number, active: number) {
    const slot = this.slots[id];
    if (!slot) {
      return;
    }
    slot.active = Math.max(0, active);
  }

  getLoads(): WorkerSlot[] {
    return this.slots.map(s => ({ ...s }));
  }
}

export default LeastLoadBalancer;
