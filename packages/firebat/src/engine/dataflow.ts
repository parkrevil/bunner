import { RoaringBitmap32 } from 'roaring';

import type { RoaringBitmap32Instance } from './types';

interface IBitSet {
  add(index: number): void;
  remove(index: number): void;
  has(index: number): boolean;
  union(other: IBitSet): IBitSet;
  intersect(other: IBitSet): IBitSet; // For liveness (intersection of succ) or union? Liveness usually uses Union of successors. But "Must-Analysis" might use Intersection?
  subtract(other: IBitSet): IBitSet;
  // Liveness: live_in = use U (live_out - def). live_out = U (live_in of successors).
  // Strictly speaking, Liveness is "May" analysis (is there ANY path where it is used?).
  // For "Dead Store" (Must NOT be used), we want to prove that Variable X is NOT live.
  // So we calculate Liveness (May-Live). If X is NOT in Live-Out, it is Dead.
  // So standard Liveness (Union) is correct for "Strict Dead Store" if we interpret the result correctly.

  clone(): IBitSet;
  isEmpty(): boolean;
  equals(other: IBitSet): boolean;
  toArray(): number[];
}

class BigIntBitSet implements IBitSet {
  private mask: bigint;

  constructor(initial: bigint = 0n) {
    this.mask = initial;
  }

  add(index: number): void {
    this.mask |= 1n << BigInt(index);
  }

  remove(index: number): void {
    this.mask &= ~(1n << BigInt(index));
  }

  has(index: number): boolean {
    return (this.mask & (1n << BigInt(index))) !== 0n;
  }

  union(other: IBitSet): IBitSet {
    if (other instanceof BigIntBitSet) {
      return new BigIntBitSet(this.mask | other.mask);
    }

    throw new Error('BitSet type mismatch in union');
  }

  intersect(other: IBitSet): IBitSet {
    if (other instanceof BigIntBitSet) {
      return new BigIntBitSet(this.mask & other.mask);
    }

    throw new Error('BitSet type mismatch in intersect');
  }

  subtract(other: IBitSet): IBitSet {
    if (other instanceof BigIntBitSet) {
      return new BigIntBitSet(this.mask & ~other.mask);
    }

    throw new Error('BitSet type mismatch in subtract');
  }

  clone(): IBitSet {
    return new BigIntBitSet(this.mask);
  }

  isEmpty(): boolean {
    return this.mask === 0n;
  }

  equals(other: IBitSet): boolean {
    if (other instanceof BigIntBitSet) {
      return this.mask === other.mask;
    }

    return false;
  }

  toArray(): number[] {
    const values: number[] = [];
    let cursor = this.mask;
    let index = 0;

    while (cursor !== 0n) {
      if ((cursor & 1n) !== 0n) {
        values.push(index);
      }

      cursor >>= 1n;
      index += 1;
    }

    return values;
  }
}

class RoaringBitSet implements IBitSet {
  private bitmap: RoaringBitmap32Instance;

  constructor(bitmap?: RoaringBitmap32Instance) {
    this.bitmap = bitmap ? new RoaringBitmap32(bitmap) : new RoaringBitmap32();
  }

  add(index: number): void {
    this.bitmap.add(index);
  }

  remove(index: number): void {
    this.bitmap.remove(index);
  }

  has(index: number): boolean {
    return this.bitmap.has(index);
  }

  union(other: IBitSet): IBitSet {
    if (other instanceof RoaringBitSet) {
      const result = new RoaringBitmap32(this.bitmap);

      result.orInPlace(other.bitmap);

      return new RoaringBitSet(result);
    }

    throw new Error('BitSet type mismatch in union');
  }

  intersect(other: IBitSet): IBitSet {
    if (other instanceof RoaringBitSet) {
      const result = new RoaringBitmap32(this.bitmap);

      result.andInPlace(other.bitmap);

      return new RoaringBitSet(result);
    }

    throw new Error('BitSet type mismatch in intersect');
  }

  subtract(other: IBitSet): IBitSet {
    if (other instanceof RoaringBitSet) {
      const result = new RoaringBitmap32(this.bitmap);

      result.andNotInPlace(other.bitmap);

      return new RoaringBitSet(result);
    }

    throw new Error('BitSet type mismatch in subtract');
  }

  clone(): IBitSet {
    return new RoaringBitSet(this.bitmap);
  }

  isEmpty(): boolean {
    return this.bitmap.isEmpty;
  }

  equals(other: IBitSet): boolean {
    if (other instanceof RoaringBitSet) {
      return this.bitmap.isEqual(other.bitmap);
    }

    return false;
  }

  toArray(): number[] {
    return this.bitmap.toArray();
  }
}

const createBitSet = (variableCount: number): IBitSet => {
  if (variableCount <= 64) {
    return new BigIntBitSet();
  }

    return new RoaringBitSet();
};

export { createBitSet };
export type { IBitSet };
