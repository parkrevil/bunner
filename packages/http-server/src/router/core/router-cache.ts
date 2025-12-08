import type { HttpMethod } from '../../enums';
import type { RouteMatch, RouterCacheEntrySnapshot } from '../types';

import type { NormalizedRouterOptions } from './router-options';

type CacheEntry = RouterCacheEntrySnapshot;
type CacheRecord = {
  version: number;
  method: HttpMethod;
  methodGeneration: number;
  entry: CacheEntry | null;
  ticket: number;
};

export class RouterCache {
  private static readonly METHOD_BASE = 0x10;
  private static readonly METHOD_TOKENS: string[] = [];
  private store?: Map<string, CacheRecord>;
  private missStore?: Map<string, CacheRecord>;
  private version = 1;
  private readonly capacity: number;
  private readonly missCapacity: number;
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
    // Probation sketch removed
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

  private static computeMissCapacity(capacity: number): number {
    const quarter = Math.max(1, Math.floor(capacity / 4));
    return Math.max(4, Math.min(quarter, 64));
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
    if (!hasExisting && this.store.size >= this.capacity) {
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
}
