import type { HttpMethod } from '../../enums';
import type { RouteKey } from '../../types';
import type { RouteMatch } from '../types';

import type { NormalizedRouterOptions } from './router-options';

export type CacheEntry = { key: RouteKey; params?: Array<[string, string | undefined]> };
export type CacheRecord = { version: number; entry: CacheEntry | null };

export class ProbationSketch {
  private readonly mask: number;
  private readonly slots: Uint32Array;

  constructor(sizePower: number) {
    this.mask = (1 << sizePower) - 1;
    this.slots = new Uint32Array(this.mask + 1);
  }

  observe(hash: number): boolean {
    const normalized = hash === 0 ? 1 : hash;
    const index = normalized & this.mask;
    if (this.slots[index] === normalized) {
      this.slots[index] = 0;
      return true;
    }
    this.slots[index] = normalized;
    return false;
  }

  reset(): void {
    this.slots.fill(0);
  }
}

export class RouterCache {
  private static readonly PROBATION_TRIGGER_FLOOR = 8;
  private static readonly PROBATION_SCORE_CLAMP = 128;
  private static readonly METHOD_BASE = 0x10;
  private static readonly METHOD_TOKENS: string[] = [];
  private store?: Map<string, CacheRecord>;
  private version = 1;
  private readonly capacity: number;
  private readonly admissionWarmTarget: number;
  private readonly probationTrigger: number;
  private admissionSketch?: ProbationSketch;
  private probationActive = false;
  private probationScore = 0;
  private lastKeyMethod?: HttpMethod;
  private lastKeyPath?: string;
  private lastKeyValue?: string;

  constructor(options: NormalizedRouterOptions) {
    if (options.enableCache) {
      this.store = new Map();
    }
    this.capacity = Math.max(1, options.cacheSize);
    this.admissionWarmTarget = RouterCache.computeWarmTarget(this.capacity);
    this.probationTrigger = Math.max(RouterCache.PROBATION_TRIGGER_FLOOR, this.admissionWarmTarget);
    this.admissionSketch = undefined;
  }

  private static resolveMethodToken(method: HttpMethod): string {
    const numeric = typeof method === 'number' ? (method as number) : (method as unknown as number);
    const tokens = RouterCache.METHOD_TOKENS;
    let token = tokens[numeric];
    if (!token) {
      token = String.fromCharCode(RouterCache.METHOD_BASE + numeric);
      tokens[numeric] = token;
    }
    return token;
  }

  private static computeWarmTarget(capacity: number): number {
    const quarter = Math.floor(capacity / 4);
    const target = quarter > 0 ? quarter : 1;
    return Math.min(capacity, Math.min(target, 256));
  }

  private static createProbationSketch(capacity: number): ProbationSketch {
    const desiredSize = Math.max(2, Math.min(1 << 16, RouterCache.nextPowerOfTwo(capacity * 2)));
    const power = Math.max(8, Math.min(16, Math.round(Math.log2(desiredSize))));
    return new ProbationSketch(power);
  }

  private static nextPowerOfTwo(value: number): number {
    let v = value - 1;
    v |= v >> 1;
    v |= v >> 2;
    v |= v >> 4;
    v |= v >> 8;
    v |= v >> 16;
    return v + 1;
  }

  private static hashKey(key: string): number {
    let hash = 0x811c9dc5;
    for (let i = 0; i < key.length; i++) {
      hash ^= key.charCodeAt(i);
      hash = (hash >>> 0) * 0x01000193;
    }
    return hash >>> 0;
  }

  isEnabled(): boolean {
    return Boolean(this.store);
  }

  clear(): void {
    if (!this.store) {
      return;
    }
    this.store.clear();
    this.resetAdmission();
  }

  bumpVersion(): void {
    this.version++;
    this.clear();
  }

  getKey(method: HttpMethod, normalizedPath: string): string {
    if (this.lastKeyMethod === method && this.lastKeyPath === normalizedPath && this.lastKeyValue) {
      return this.lastKeyValue;
    }
    const methodToken = RouterCache.resolveMethodToken(method);
    const key = methodToken + normalizedPath;
    this.lastKeyMethod = method;
    this.lastKeyPath = normalizedPath;
    this.lastKeyValue = key;
    return key;
  }

  cacheNullMiss(method: HttpMethod, normalized: string, existingKey?: string): void {
    if (!this.store) {
      return;
    }
    const key = existingKey ?? this.getKey(method, normalized);
    const hasExisting = this.store.has(key);
    if (!this.shouldAdmit(key, hasExisting)) {
      return;
    }
    this.writeRecord(key, { version: this.version, entry: null }, hasExisting);
  }

  get(key: string): CacheRecord | undefined {
    return this.store?.get(key);
  }

  isStale(record: CacheRecord): boolean {
    return record.version !== this.version;
  }

  touch(key: string, record: CacheRecord): void {
    if (!this.store) {
      return;
    }
    this.store.delete(key);
    this.store.set(key, record);
  }

  delete(key: string): void {
    this.store?.delete(key);
  }

  set(key: string, value: RouteMatch | null, paramsEntries?: Array<[string, string | undefined]>): void {
    if (!this.store) {
      return;
    }
    const hasExisting = this.store.has(key);
    if (!hasExisting && !this.shouldAdmit(key, false)) {
      return;
    }
    if (this.store.has(key)) {
      this.store.delete(key);
    }
    let record: CacheRecord;
    if (value === null) {
      record = { version: this.version, entry: null };
    } else {
      let entries = paramsEntries;
      if (!entries) {
        const paramKeys = Object.keys(value.params);
        if (paramKeys.length) {
          entries = new Array<[string, string | undefined]>(paramKeys.length);
          for (let i = 0; i < paramKeys.length; i++) {
            const name = paramKeys[i]!;
            entries[i] = [name, value.params[name]];
          }
        }
      }
      const snapshot: CacheEntry = entries && entries.length ? { key: value.key, params: entries } : { key: value.key };
      record = { version: this.version, entry: snapshot };
    }
    this.writeRecord(key, record, hasExisting);
  }

  private resetAdmission(): void {
    this.admissionSketch?.reset();
    this.probationActive = false;
    this.probationScore = 0;
  }

  private shouldAdmit(key: string, hasExistingRecord: boolean): boolean {
    if (!this.store) {
      return false;
    }
    if (hasExistingRecord) {
      return true;
    }
    if (this.store.size < this.admissionWarmTarget) {
      return true;
    }
    if (!this.probationActive) {
      if (this.store.size >= this.admissionWarmTarget) {
        this.enableProbation();
      }
      if (!this.probationActive) {
        return true;
      }
    }
    if (this.store.size < this.admissionWarmTarget) {
      this.disableProbation();
      return true;
    }
    const sketch = (this.admissionSketch ??= RouterCache.createProbationSketch(this.capacity));
    const hash = RouterCache.hashKey(key);
    const admitted = sketch.observe(hash);
    this.adjustProbationScore(admitted);
    return admitted;
  }

  private writeRecord(key: string, record: CacheRecord, hasExistingRecord: boolean): void {
    if (!this.store) {
      return;
    }
    if (hasExistingRecord) {
      this.store.delete(key);
    }
    this.store.set(key, record);
    if (this.store.size > this.capacity) {
      const first = this.store.keys().next().value;
      if (first !== undefined) {
        this.store.delete(first);
      }
    }
  }

  private enableProbation(): void {
    if (this.probationActive) {
      return;
    }
    this.probationActive = true;
    this.probationScore = 0;
    if (this.admissionSketch) {
      this.admissionSketch.reset();
    } else {
      this.admissionSketch = RouterCache.createProbationSketch(this.capacity);
    }
  }

  private disableProbation(): void {
    if (!this.probationActive) {
      return;
    }
    this.probationActive = false;
    this.probationScore = 0;
    this.admissionSketch?.reset();
  }

  private adjustProbationScore(admitted: boolean): void {
    if (!this.probationActive) {
      return;
    }
    this.probationScore += admitted ? -1 : 1;
    if (this.probationScore > RouterCache.PROBATION_SCORE_CLAMP) {
      this.probationScore = RouterCache.PROBATION_SCORE_CLAMP;
    }
    if (this.probationScore <= -this.probationTrigger) {
      this.disableProbation();
    }
  }
}
