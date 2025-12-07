import type { HttpMethod } from '../../enums';
import type { RouteMatch, RouterCacheEntrySnapshot, RouterCacheSnapshot, RouterCacheSnapshotEntry } from '../types';

import type { NormalizedRouterOptions } from './router-options';

type CacheEntry = RouterCacheEntrySnapshot;
type CacheRecord = {
  version: number;
  method: HttpMethod;
  methodGeneration: number;
  entry: CacheEntry | null;
  ticket: number;
};

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
  private missStore?: Map<string, CacheRecord>;
  private version = 1;
  private readonly capacity: number;
  private readonly missCapacity: number;
  private readonly admissionWarmTarget: number;
  private readonly probationTrigger: number;
  private admissionSketch?: ProbationSketch;
  private probationActive = false;
  private probationScore = 0;
  private lastKeyMethod?: HttpMethod;
  private lastKeyPath?: string;
  private lastKeyValue?: string;
  private methodGenerations: number[] = [];
  private methodMissCounters: number[] = [];
  private evictionRing?: Array<{ key: string; ticket: number } | undefined>;
  private evictionHead = 0;
  private evictionTail = 0;
  private evictionFill = 0;
  private ticketCounter = 1;

  constructor(options: NormalizedRouterOptions) {
    if (options.enableCache) {
      this.store = new Map();
      this.missStore = new Map();
    }
    this.capacity = Math.max(1, options.cacheSize);
    this.missCapacity = RouterCache.computeMissCapacity(this.capacity);
    this.admissionWarmTarget = RouterCache.computeWarmTarget(this.capacity);
    this.probationTrigger = RouterCache.computeProbationTrigger(this.capacity, this.admissionWarmTarget);
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

  private static computeMissCapacity(capacity: number): number {
    const quarter = Math.max(1, Math.floor(capacity / 4));
    return Math.max(4, Math.min(quarter, 64));
  }

  private static computeProbationTrigger(capacity: number, warmTarget: number): number {
    const half = Math.max(1, Math.floor(capacity / 2));
    return Math.max(RouterCache.PROBATION_TRIGGER_FLOOR, Math.min(half, Math.max(half, warmTarget)));
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
    this.missStore?.clear();
    this.resetAdmission();
    this.resetEvictionRing();
    this.methodGenerations.length = 0;
    this.methodMissCounters.length = 0;
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
    if (!this.store || !this.missStore) {
      return;
    }
    const key = existingKey ?? this.getKey(method, normalized);
    const record: CacheRecord = {
      version: this.version,
      method,
      methodGeneration: this.getMethodGeneration(method),
      entry: null,
      ticket: this.nextTicket(),
    };
    this.writeMissRecord(method, key, record);
    this.trackMethodMiss(method);
  }

  get(key: string): CacheRecord | undefined {
    if (!this.store) {
      return undefined;
    }
    return this.store.get(key) ?? this.missStore?.get(key);
  }

  isStale(record: CacheRecord): boolean {
    if (record.version !== this.version) {
      return true;
    }
    return record.methodGeneration !== this.getMethodGeneration(record.method);
  }

  touch(key: string, record: CacheRecord): void {
    if (!this.store) {
      return;
    }
    if (this.store.has(key)) {
      record.ticket = this.nextTicket();
      this.store.delete(key);
      this.store.set(key, record);
      this.recordEvictionCandidate(key, record.ticket);
      return;
    }
    if (this.missStore?.has(key)) {
      this.missStore.delete(key);
      this.missStore.set(key, record);
    }
  }

  delete(key: string): void {
    this.store?.delete(key);
    this.missStore?.delete(key);
  }

  exportSnapshot(): RouterCacheSnapshot | null {
    if (!this.store) {
      return null;
    }
    const entries: RouterCacheSnapshotEntry[] = [];
    for (const [key, record] of this.store) {
      entries.push({ key, method: record.method, entry: record.entry });
      if (entries.length >= this.capacity) {
        break;
      }
    }
    if (this.missStore) {
      for (const [key, record] of this.missStore) {
        entries.push({ key, method: record.method, entry: null });
        if (entries.length >= this.capacity + this.missCapacity) {
          break;
        }
      }
    }
    return { version: this.version, entries };
  }

  hydrateSnapshot(snapshot: RouterCacheSnapshot | null): void {
    if (!this.store || !snapshot || snapshot.version !== this.version) {
      return;
    }
    this.clear();
    for (const entry of snapshot.entries) {
      const record: CacheRecord = {
        version: this.version,
        method: entry.method,
        methodGeneration: this.getMethodGeneration(entry.method),
        entry: entry.entry,
        ticket: this.nextTicket(),
      };
      if (entry.entry) {
        this.writeHitRecord(entry.key, record, false);
      } else {
        this.writeMissRecord(entry.method, entry.key, record);
      }
    }
  }

  set(method: HttpMethod, key: string, value: RouteMatch | null, paramsEntries?: Array<[string, string | undefined]>): void {
    if (!this.store) {
      return;
    }
    if (value === null) {
      const missRecord: CacheRecord = {
        version: this.version,
        method,
        methodGeneration: this.getMethodGeneration(method),
        entry: null,
        ticket: this.nextTicket(),
      };
      this.writeMissRecord(method, key, missRecord);
      this.trackMethodMiss(method);
      return;
    }
    const hasExisting = this.store.has(key);
    if (!hasExisting && !this.shouldAdmitHit(key, false)) {
      return;
    }
    this.missStore?.delete(key);
    this.resetMethodMiss(method);
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
    const record: CacheRecord = {
      version: this.version,
      method,
      methodGeneration: this.getMethodGeneration(method),
      entry: snapshot,
      ticket: this.nextTicket(),
    };
    this.writeHitRecord(key, record, hasExisting);
  }

  private resetAdmission(): void {
    this.admissionSketch?.reset();
    this.probationActive = false;
    this.probationScore = 0;
  }

  private resetEvictionRing(): void {
    this.evictionRing = undefined;
    this.evictionHead = 0;
    this.evictionTail = 0;
    this.evictionFill = 0;
  }

  private nextTicket(): number {
    const value = this.ticketCounter;
    this.ticketCounter = value === Number.MAX_SAFE_INTEGER ? 1 : value + 1;
    return value;
  }

  private ensureEvictionRing(): void {
    const desiredLength = Math.min(65536, Math.max(4, Math.min(this.capacity * 4, this.capacity + 64)));
    if (!this.evictionRing || this.evictionRing.length !== desiredLength) {
      this.evictionRing = new Array(desiredLength);
      this.evictionHead = 0;
      this.evictionTail = 0;
      this.evictionFill = 0;
    }
  }

  private recordEvictionCandidate(key: string, ticket: number): void {
    if (!this.store) {
      return;
    }
    this.ensureEvictionRing();
    const ring = this.evictionRing!;
    ring[this.evictionTail] = { key, ticket };
    this.evictionTail = (this.evictionTail + 1) % ring.length;
    if (this.evictionFill < ring.length) {
      this.evictionFill++;
    } else {
      this.evictionHead = this.evictionTail;
    }
  }

  private evictIfNeeded(): void {
    if (!this.store || !this.evictionRing || this.store.size <= this.capacity) {
      return;
    }
    let attempts = 0;
    const limit = this.evictionRing.length;
    while (attempts < limit && this.evictionFill > 0) {
      const slot = this.evictionRing[this.evictionHead];
      this.evictionRing[this.evictionHead] = undefined;
      this.evictionHead = (this.evictionHead + 1) % this.evictionRing.length;
      this.evictionFill--;
      attempts++;
      if (!slot) {
        continue;
      }
      const record = this.store.get(slot.key);
      if (!record || record.ticket !== slot.ticket) {
        continue;
      }
      this.store.delete(slot.key);
      return;
    }
    if (this.store.size > this.capacity) {
      const first = this.store.keys().next().value;
      if (first !== undefined) {
        this.store.delete(first);
      }
    }
  }

  private shouldAdmitHit(key: string, hasExistingRecord: boolean): boolean {
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
    this.coolProbationScore();
    const sketch = (this.admissionSketch ??= RouterCache.createProbationSketch(this.capacity));
    const hash = RouterCache.hashKey(key);
    const admitted = sketch.observe(hash);
    this.adjustProbationScore(admitted);
    return admitted;
  }

  private getMethodIndex(method: HttpMethod): number {
    return typeof method === 'number' ? (method as number) : (method as unknown as number);
  }

  private getMethodGeneration(method: HttpMethod): number {
    return this.methodGenerations[this.getMethodIndex(method)] ?? 0;
  }

  private resetMethodMiss(method: HttpMethod): void {
    this.methodMissCounters[this.getMethodIndex(method)] = 0;
  }

  private trackMethodMiss(method: HttpMethod): void {
    const idx = this.getMethodIndex(method);
    const next = (this.methodMissCounters[idx] ?? 0) + 1;
    this.methodMissCounters[idx] = next;
    if (next >= this.missCapacity) {
      this.bumpMethodGeneration(method);
    }
  }

  private bumpMethodGeneration(method: HttpMethod): void {
    const idx = this.getMethodIndex(method);
    const next = (this.methodGenerations[idx] ?? 0) + 1;
    this.methodGenerations[idx] = next;
    this.methodMissCounters[idx] = 0;
    this.pruneMethodEntries(method);
  }

  private pruneMethodEntries(method: HttpMethod): void {
    if (this.store) {
      for (const [key, record] of this.store) {
        if (record.method === method) {
          this.store.delete(key);
        }
      }
    }
    if (this.missStore) {
      for (const [key, record] of this.missStore) {
        if (record.method === method) {
          this.missStore.delete(key);
        }
      }
    }
  }

  private writeHitRecord(key: string, record: CacheRecord, hasExistingRecord: boolean): void {
    if (!this.store) {
      return;
    }
    if (hasExistingRecord) {
      this.store.delete(key);
      this.store.set(key, record);
      return;
    }
    this.store.set(key, record);
    this.recordEvictionCandidate(key, record.ticket);
    this.evictIfNeeded();
  }

  private writeMissRecord(_method: HttpMethod, key: string, record: CacheRecord): void {
    if (!this.missStore) {
      return;
    }
    this.store?.delete(key);
    if (this.missStore.has(key)) {
      this.missStore.delete(key);
    }
    this.missStore.set(key, record);
    if (this.missStore.size > this.missCapacity) {
      const first = this.missStore.keys().next().value;
      if (first !== undefined) {
        this.missStore.delete(first);
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

  private coolProbationScore(): void {
    if (!this.probationActive || this.probationScore === 0) {
      return;
    }
    if (this.probationScore > 0) {
      this.probationScore--;
    } else {
      this.probationScore++;
    }
  }
}
