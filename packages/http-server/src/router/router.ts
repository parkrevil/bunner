import { HttpMethod } from '../enums';
import type { RouteKey } from '../types';

import { hydrateParams } from './cache-helpers';
import { NodeKind } from './enums';
import type { Router } from './interfaces';
import { DynamicMatcher } from './match-walker';
import { RouterNode } from './node';
import { buildPatternTester } from './pattern-tester';
import { matchStaticParts, splitStaticChain } from './tree-utils';
import type { DynamicMatchResult, RouterOptions, RouteMatch, StaticProbeResult } from './types';
import { normalizeAndSplit, type NormalizedPathSegments } from './utils';

type CacheEntry = { key: RouteKey; params?: Array<[string, string]> };

let GLOBAL_ROUTE_KEY_SEQ = 1 as RouteKey;

export class RadixRouter implements Router {
  private root: RouterNode;
  private options: Required<RouterOptions>;
  private cache?: Map<string, CacheEntry | null>;
  private staticFast: Map<string, Map<HttpMethod, RouteKey>> = new Map();
  private needsCompression = false;
  private cacheKeyPrefixes: Record<number, string> = Object.create(null);
  private lastCacheKeyMethod?: HttpMethod;
  private lastCacheKeyPath?: string;
  private lastCacheKeyValue?: string;
  private hasWildcardRoutes = false;
  private hasDynamicRoutes = false;

  constructor(options?: RouterOptions) {
    this.options = {
      ignoreTrailingSlash: options?.ignoreTrailingSlash ?? true,
      collapseSlashes: options?.collapseSlashes ?? true,
      caseSensitive: options?.caseSensitive ?? true,
      decodeParams: options?.decodeParams ?? true,
      blockTraversal: options?.blockTraversal ?? true,
      enableCache: options?.enableCache ?? false,
      cacheSize: options?.cacheSize ?? 1024,
    };
    this.root = new RouterNode(NodeKind.Static, '');
    if (this.options.enableCache) {
      this.cache = new Map();
    }
  }

  addAll(entries: Array<[HttpMethod, string]>): RouteKey[] {
    const keys: RouteKey[] = new Array(entries.length);
    for (let i = 0; i < entries.length; i++) {
      const [method, path] = entries[i]!;
      const prepared = normalizeAndSplit(path, this.options);
      const key = this.insertRoute(method, path, prepared);
      keys[i] = key;
      this.registerStaticFastRoute(method, prepared.normalized, path, key);
    }
    this.markDirty();
    return keys;
  }

  add(method: HttpMethod | HttpMethod[] | '*', path: string): RouteKey | RouteKey[] {
    if (method === '*') {
      const methods = Object.values(HttpMethod).filter(v => typeof v === 'number') as HttpMethod[];
      return this.addAll(methods.map(m => [m, path]));
    }
    if (Array.isArray(method)) {
      return this.addAll(method.map(m => [m, path]));
    }
    const prepared = normalizeAndSplit(path, this.options);
    const key = this.insertRoute(method, path, prepared);
    this.registerStaticFastRoute(method, prepared.normalized, path, key);
    this.markDirty();
    return key;
  }

  match(method: HttpMethod, path: string): RouteMatch | null {
    this.ensureCompressed();

    const staticProbe = this.tryStaticFastMatch(method, path);
    if (staticProbe.kind === 'hit') {
      return staticProbe.match;
    }

    const prepared = normalizeAndSplit(path, this.options);
    const normalized = prepared.normalized;

    if (staticProbe.kind === 'static-miss') {
      this.cacheNullMiss(method, normalized);
      return null;
    }
    const directBucket = this.staticFast.get(normalized);
    const fastHit = this.matchStaticEntry(directBucket, method);
    if (fastHit) {
      return fastHit;
    }

    const cacheKey = this.cache ? this.getCacheKey(method, normalized) : undefined;
    if (cacheKey && this.cache && this.cache.has(cacheKey)) {
      const entry = this.cache.get(cacheKey);
      if (entry === null) {
        return null;
      }
      if (entry) {
        return { key: entry.key, params: hydrateParams(entry.params) };
      }
    }

    const captureSnapshot = Boolean(cacheKey && this.cache);
    const dynamicMatch = this.findDynamicMatch(method, prepared.segments, captureSnapshot);
    if (!dynamicMatch) {
      this.cacheNullMiss(method, normalized, cacheKey);
      return null;
    }

    const resolved: RouteMatch = { key: dynamicMatch.key, params: dynamicMatch.params };
    if (cacheKey && this.cache) {
      this.setCache(cacheKey, resolved, dynamicMatch.snapshot);
    }
    return resolved;
  }

  private tryStaticFastMatch(method: HttpMethod, path: string): StaticProbeResult {
    if (!path.length || path.charCodeAt(0) !== 47) {
      return { kind: 'fallback' };
    }
    const normalized = this.ensureCaseNormalized(path);
    const direct = this.matchStaticEntry(this.staticFast.get(normalized), method);
    if (direct) {
      return { kind: 'hit', match: direct };
    }
    let trimmed: string | undefined;
    if (this.options.ignoreTrailingSlash && normalized.length > 1) {
      const candidate = this.trimTrailingSlashes(normalized);
      if (candidate !== normalized) {
        trimmed = candidate;
        const trimmedHit = this.matchStaticEntry(this.staticFast.get(candidate), method);
        if (trimmedHit) {
          return { kind: 'hit', match: trimmedHit };
        }
      }
    }
    const probeKey = trimmed ?? normalized;
    if (!this.hasDynamicRoutes && !this.hasWildcardRoutes && this.isSimpleStaticPath(probeKey, !this.options.caseSensitive)) {
      return { kind: 'static-miss' };
    }
    return { kind: 'fallback' };
  }

  private findDynamicMatch(method: HttpMethod, segments: string[], captureSnapshot: boolean): DynamicMatchResult | null {
    const matcher = new DynamicMatcher({
      method,
      segments,
      decodeParams: this.options.decodeParams,
      hasWildcardRoutes: this.hasWildcardRoutes,
      captureSnapshot,
    });
    return matcher.match(this.root);
  }

  private registerStaticFastRoute(method: HttpMethod, normalizedPath: string, sourcePath: string, key: RouteKey): void {
    if (this.pathContainsDynamicTokens(sourcePath)) {
      return;
    }
    let bucket = this.staticFast.get(normalizedPath);
    if (!bucket) {
      bucket = new Map();
      this.staticFast.set(normalizedPath, bucket);
    }
    bucket.set(method, key);
  }

  private pathContainsDynamicTokens(path: string): boolean {
    return path.indexOf(':') !== -1 || path.indexOf('*') !== -1;
  }

  private markDirty(): void {
    this.needsCompression = true;
    this.clearCache();
  }

  private clearCache(): void {
    if (this.cache) {
      this.cache.clear();
    }
  }

  private cacheNullMiss(method: HttpMethod, normalized: string, existingKey?: string): void {
    if (!this.cache) {
      return;
    }
    const key = existingKey ?? this.getCacheKey(method, normalized);
    this.setCache(key, null);
  }

  private insertRoute(method: HttpMethod, path: string, prepared?: NormalizedPathSegments): RouteKey {
    const preparedPath = prepared ?? normalizeAndSplit(path, this.options);
    const { segments } = preparedPath;
    let firstKey: RouteKey | null = null;
    const registerParamName = (name: string, active: Set<string>): (() => void) => {
      if (active.has(name)) {
        throw new Error(`Duplicate parameter name ':${name}' detected in path: ${path}`);
      }
      active.add(name);
      return () => {
        active.delete(name);
      };
    };
    const addSegments = (node: RouterNode, idx: number, activeParams: Set<string>): void => {
      if (idx === segments.length) {
        const existing = node.methods.byMethod.get(method);
        if (existing !== undefined) {
          throw new Error(`Route already exists for method at path: ${path}`);
        }
        const key = GLOBAL_ROUTE_KEY_SEQ++ as unknown as RouteKey;
        node.methods.byMethod.set(method, key);
        node.methods.version = (node.methods.version ?? 0) + 1;
        if (firstKey === null) {
          firstKey = key;
        }
        return;
      }
      const seg = segments[idx]!;
      if (seg.charCodeAt(0) === 42 /* '*' */) {
        // Conflict: wildcard cannot coexist with other children (would shadow them)
        if (node.staticChildren.size || node.paramChildren.length) {
          throw new Error(`Conflict: adding wildcard '*' at '${segments.slice(0, idx).join('/')}' would shadow existing routes`);
        }
        if (idx !== segments.length - 1) {
          throw new Error("Wildcard '*' must be the last segment");
        }
        const name = seg.length > 1 ? seg.slice(1) : '*';
        if (!node.wildcardChild) {
          node.wildcardChild = new RouterNode(NodeKind.Wildcard, name);
        }
        this.hasWildcardRoutes = true;
        this.hasDynamicRoutes = true;
        const release = registerParamName(name, activeParams);
        try {
          addSegments(node.wildcardChild, idx + 1, activeParams);
        } finally {
          release();
        }
        return;
      }
      if (seg.charCodeAt(0) === 58 /* ':' */) {
        this.hasDynamicRoutes = true;
        let optional = false;
        let core = seg;
        if (seg.endsWith('?')) {
          optional = true;
          core = seg.slice(0, -1);
        }
        let multi = false;
        if (core.endsWith('+')) {
          multi = true;
          core = core.slice(0, -1);
        }
        const brace = core.indexOf('{');
        let name = '';
        let patternSrc: string | undefined;
        if (brace === -1) {
          name = core.slice(1);
        } else {
          name = core.slice(1, brace);
          if (!core.endsWith('}')) {
            throw new Error("Parameter regex must close with '}'");
          }
          patternSrc = core.slice(brace + 1, -1) || undefined;
        }
        if (!name) {
          throw new Error("Parameter segment must have a name, eg ':id'");
        }
        if (optional) {
          addSegments(node, idx + 1, activeParams);
        }
        const releaseName = registerParamName(name, activeParams);
        if (multi) {
          if (idx !== segments.length - 1) {
            throw new Error("Multi-segment param ':name+' must be the last segment");
          }
          if (!node.wildcardChild) {
            node.wildcardChild = new RouterNode(NodeKind.Wildcard, name || '*');
          }
          this.hasWildcardRoutes = true;
          this.hasDynamicRoutes = true;
          try {
            addSegments(node.wildcardChild, idx + 1, activeParams);
          } finally {
            releaseName();
          }
          return;
        }
        let child: RouterNode | undefined;
        for (const c of node.paramChildren) {
          if (c.segment === name && (c.pattern?.source ?? undefined) === (patternSrc ?? undefined)) {
            child = c;
            break;
          }
        }
        if (!child) {
          // Conflict: same name with different regex already present
          const dup = node.paramChildren.find(c => c.segment === name && (c.pattern?.source ?? '') !== (patternSrc ?? ''));
          if (dup) {
            throw new Error(
              `Conflict: parameter ':${name}' with different regex already exists at '${segments.slice(0, idx).join('/')}'`,
            );
          }
          // Conflict: attempting to add param beneath a wildcard sibling
          if (node.wildcardChild) {
            throw new Error(
              `Conflict: adding parameter ':${name}' under existing wildcard at '${segments.slice(0, idx).join('/')}'`,
            );
          }
          child = new RouterNode(NodeKind.Param, name);
          if (patternSrc) {
            child.pattern = new RegExp(`^(?:${patternSrc})$`);
            child.patternSource = patternSrc;
            child.patternTester = buildPatternTester(patternSrc, child.pattern);
          }
          node.paramChildren.push(child);
          this.sortParamChildren(node);
        }
        try {
          addSegments(child, idx + 1, activeParams);
        } finally {
          releaseName();
        }
        return;
      }
      let child = node.staticChildren.get(seg);
      if (!child && node.wildcardChild) {
        // Conflict: static segment would be shadowed by existing wildcard
        throw new Error(
          `Conflict: adding static segment '${seg}' under existing wildcard at '${segments.slice(0, idx).join('/')}'`,
        );
      }
      if (child) {
        const parts = child.segmentParts;
        if (parts && parts.length > 1) {
          const matched = matchStaticParts(parts, segments, idx);
          if (matched < parts.length) {
            splitStaticChain(child, matched);
          }
          if (matched > 1) {
            addSegments(child, idx + matched, activeParams);
            return;
          }
        }
        addSegments(child, idx + 1, activeParams);
        return;
      }
      child = new RouterNode(NodeKind.Static, seg);
      node.staticChildren.set(seg, child);
      addSegments(child, idx + 1, activeParams);
    };
    addSegments(this.root, 0, new Set());
    return firstKey!;
  }

  private matchStaticEntry(bucket: Map<HttpMethod, RouteKey> | undefined, method: HttpMethod): RouteMatch | undefined {
    if (!bucket) {
      return undefined;
    }
    const key = bucket.get(method);
    if (key === undefined) {
      return undefined;
    }
    return { key, params: Object.create(null) };
  }

  private sortParamChildren(node: RouterNode): void {
    if (node.paramChildren.length < 2) {
      return;
    }
    node.paramChildren.sort((a, b) => {
      const weight = (child: RouterNode) => (child.pattern ? 0 : 1);
      const diff = weight(a) - weight(b);
      if (diff !== 0) {
        return diff;
      }
      if (a.pattern && b.pattern) {
        const aLen = a.patternSource?.length ?? 0;
        const bLen = b.patternSource?.length ?? 0;
        if (aLen !== bLen) {
          return bLen - aLen;
        }
      }
      return a.segment.localeCompare(b.segment);
    });
  }

  private ensureCaseNormalized(path: string): string {
    if (this.options.caseSensitive) {
      return path;
    }
    for (let i = 0; i < path.length; i++) {
      const code = path.charCodeAt(i);
      if (code >= 65 && code <= 90) {
        return path.toLowerCase();
      }
    }
    return path;
  }

  private trimTrailingSlashes(path: string): string {
    let end = path.length;
    while (end > 1 && path.charCodeAt(end - 1) === 47) {
      end--;
    }
    if (end === path.length) {
      return path;
    }
    return end === 1 ? '/' : path.slice(0, end);
  }

  private isSimpleStaticPath(path: string, allowCaseNormalized: boolean = false): boolean {
    if (!path.length || path.charCodeAt(0) !== 47) {
      return false;
    }
    if (!this.options.caseSensitive && !allowCaseNormalized) {
      return false;
    }
    if (this.options.collapseSlashes === false) {
      return false;
    }
    if (this.options.blockTraversal === false) {
      return false;
    }
    let lastSlash = 0;
    for (let i = 1; i < path.length; i++) {
      const code = path.charCodeAt(i);
      if (code !== 47) {
        continue;
      }
      if (i === lastSlash + 1) {
        return false;
      }
      if (this.isDotSegment(path, lastSlash + 1, i)) {
        return false;
      }
      lastSlash = i;
    }
    if (lastSlash < path.length - 1 && this.isDotSegment(path, lastSlash + 1, path.length)) {
      return false;
    }
    return true;
  }

  private isDotSegment(path: string, start: number, end: number): boolean {
    const len = end - start;
    if (len === 1 && path.charCodeAt(start) === 46) {
      return true;
    }
    if (len === 2 && path.charCodeAt(start) === 46 && path.charCodeAt(start + 1) === 46) {
      return true;
    }
    return false;
  }

  private compressStaticPaths(): void {
    const compressFrom = (parent: RouterNode) => {
      const children = Array.from(parent.staticChildren.values());
      for (const child of children) {
        compressFrom(child);
        let cursor = child;
        const parts: string[] = child.segmentParts ? [...child.segmentParts] : [child.segment];
        while (
          cursor.kind === NodeKind.Static &&
          cursor.methods.byMethod.size === 0 &&
          cursor.paramChildren.length === 0 &&
          !cursor.wildcardChild &&
          cursor.staticChildren.size === 1
        ) {
          const next = cursor.staticChildren.values().next().value as RouterNode;
          if (next.kind !== NodeKind.Static) {
            break;
          }
          const nextParts = next.segmentParts ?? [next.segment];
          parts.push(...nextParts);
          cursor = next;
        }
        if (parts.length > 1) {
          child.segment = parts.join('/');
          child.segmentParts = parts;
          child.staticChildren = cursor.staticChildren;
          child.paramChildren = cursor.paramChildren;
          child.wildcardChild = cursor.wildcardChild;
          child.methods = cursor.methods;
        }
      }
    };
    compressFrom(this.root);
  }

  private ensureCompressed(): void {
    if (!this.needsCompression) {
      return;
    }
    this.compressStaticPaths();
    this.needsCompression = false;
  }

  private setCache(key: string, value: RouteMatch | null, paramsEntries?: Array<[string, string]>): void {
    if (!this.cache) {
      return;
    }
    // LRU discipline via delete+set
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    if (value === null) {
      this.cache.set(key, null);
    } else {
      let entries = paramsEntries;
      if (!entries) {
        const paramKeys = Object.keys(value.params);
        if (paramKeys.length) {
          entries = new Array<[string, string]>(paramKeys.length);
          for (let i = 0; i < paramKeys.length; i++) {
            const name = paramKeys[i]!;
            entries[i] = [name, value.params[name]!];
          }
        }
      }
      const snapshot: CacheEntry = entries && entries.length ? { key: value.key, params: entries } : { key: value.key };
      this.cache.set(key, snapshot);
    }
    if (this.cache.size > this.options.cacheSize) {
      const first = this.cache.keys().next().value;
      if (first !== undefined) {
        this.cache.delete(first);
      }
    }
  }

  private getCacheKey(method: HttpMethod, normalized: string): string {
    const normalizedKey = normalized.length > 1 && normalized.charCodeAt(0) === 47 ? normalized.slice(1) : normalized;
    if (this.lastCacheKeyMethod === method && this.lastCacheKeyPath === normalizedKey && this.lastCacheKeyValue) {
      return this.lastCacheKeyValue;
    }
    let prefix = this.cacheKeyPrefixes[method as number];
    if (!prefix) {
      prefix = `${method} `;
      this.cacheKeyPrefixes[method as number] = prefix;
    }
    const key = prefix + normalizedKey;
    this.lastCacheKeyMethod = method;
    this.lastCacheKeyPath = normalizedKey;
    this.lastCacheKeyValue = key;
    return key;
  }
}

export default RadixRouter;
