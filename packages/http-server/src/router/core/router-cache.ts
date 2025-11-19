import type { HttpMethod } from '../../enums';
import type { RouteKey } from '../../types';
import type { RouteMatch } from '../types';

import type { NormalizedRouterOptions } from './router-options';

export type CacheEntry = { key: RouteKey; params?: Array<[string, string | undefined]> };
export type CacheRecord = { version: number; entry: CacheEntry | null };

export const CACHE_NULL_HIT = Symbol('cache-null-hit');

export class RouterCache {
  private store?: Map<string, CacheRecord>;
  private version = 1;
  private lastKeyMethod?: HttpMethod;
  private lastKeyPath?: string;
  private lastKeyValue?: string;

  constructor(private readonly options: NormalizedRouterOptions) {
    if (options.enableCache) {
      this.store = new Map();
    }
  }

  isEnabled(): boolean {
    return Boolean(this.store);
  }

  clear(): void {
    this.store?.clear();
  }

  bumpVersion(): void {
    this.version++;
    this.clear();
  }

  getKey(method: HttpMethod, normalizedPath: string): string {
    const normalizedKey = this.toCachePath(normalizedPath);
    if (this.lastKeyMethod === method && this.lastKeyPath === normalizedKey && this.lastKeyValue) {
      return this.lastKeyValue;
    }
    const key = `${method}\u0000${normalizedKey}`;
    this.lastKeyMethod = method;
    this.lastKeyPath = normalizedKey;
    this.lastKeyValue = key;
    return key;
  }

  cacheNullMiss(method: HttpMethod, normalized: string, existingKey?: string): void {
    if (!this.store) {
      return;
    }
    const key = existingKey ?? this.getKey(method, normalized);
    this.set(key, null);
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
    this.store.set(key, record);
    if (this.store.size > this.options.cacheSize) {
      const first = this.store.keys().next().value;
      if (first !== undefined) {
        this.store.delete(first);
      }
    }
  }

  private toCachePath(normalized: string): string {
    if (normalized.length > 1 && normalized.charCodeAt(0) === 47) {
      return normalized.slice(1);
    }
    return normalized;
  }
}
