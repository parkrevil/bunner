import { HttpMethod } from '../enums';
import type { RouteKey } from '../types';

import { NodeKind } from './enums';
import type { Router } from './interfaces';
import { RouterNode } from './node';
import type { RouterOptions, RouteMatch } from './types';
import { normalizeAndSplit, decodeURIComponentSafe, type NormalizedPathSegments } from './utils';

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
    const out: RouteKey[] = new Array(entries.length);
    for (let i = 0; i < entries.length; i++) {
      const [m, p] = entries[i]!;
      const prepared = normalizeAndSplit(p, this.options);
      const norm = prepared.normalized;
      out[i] = this._addSingle(m, p, prepared);
      if (p.indexOf(':') === -1 && p.indexOf('*') === -1) {
        let by = this.staticFast.get(norm);
        if (!by) {
          by = new Map();
          this.staticFast.set(norm, by);
        }
        by.set(m, out[i]!);
      }
    }
    this.needsCompression = true;
    if (this.cache) {
      this.cache.clear();
    }
    return out;
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
    const norm = prepared.normalized;
    const k = this._addSingle(method, path, prepared);
    if (path.indexOf(':') === -1 && path.indexOf('*') === -1) {
      let by = this.staticFast.get(norm);
      if (!by) {
        by = new Map();
        this.staticFast.set(norm, by);
      }
      by.set(method, k);
    }
    this.needsCompression = true;
    if (this.cache) {
      this.cache.clear();
    }
    return k;
  }

  match(method: HttpMethod, path: string): RouteMatch | null {
    this.ensureCompressed();
    if (path.length && path.charCodeAt(0) === 47) {
      const rawKey = this.ensureCaseNormalized(path);
      let direct = this.matchStaticEntry(this.staticFast.get(rawKey), method);
      if (direct) {
        return direct;
      }
      let trimmed: string | undefined;
      if (this.options.ignoreTrailingSlash && rawKey.length > 1) {
        const candidate = this.trimTrailingSlashes(rawKey);
        if (candidate !== rawKey) {
          trimmed = candidate;
          direct = this.matchStaticEntry(this.staticFast.get(candidate), method);
          if (direct) {
            return direct;
          }
        }
      }
      const evalKey = trimmed ?? rawKey;
      if (!this.hasDynamicRoutes && !this.hasWildcardRoutes && this.isSimpleStaticPath(evalKey, !this.options.caseSensitive)) {
        return null;
      }
    }

    const prepared = normalizeAndSplit(path, this.options);
    const normalized = prepared.normalized;
    const segments = prepared.segments;
    const fast = this.staticFast.get(normalized);
    if (fast) {
      const k = fast.get(method);
      if (k !== undefined) {
        return { key: k, params: Object.create(null) };
      }
    }

    const shouldDecode = this.options.decodeParams;
    let decodedSegmentCache: Array<string | undefined> | undefined;
    let suffixCache: string[] | undefined;
    let decodedSuffixCache: Array<string | undefined> | undefined;

    const ensureSuffixCache = () => {
      if (suffixCache || !this.hasWildcardRoutes || !segments.length) {
        return;
      }
      suffixCache = new Array(segments.length);
      let suffix = '';
      for (let i = segments.length - 1; i >= 0; i--) {
        suffix = suffix ? `${segments[i]!}/${suffix}` : segments[i]!;
        suffixCache[i] = suffix;
      }
    };

    const getDecodedSegment = (index: number): string => {
      if (!shouldDecode) {
        return segments[index]!;
      }
      decodedSegmentCache ??= new Array<string | undefined>(segments.length);
      const cached = decodedSegmentCache[index];
      if (cached !== undefined) {
        return cached;
      }
      const value = decodeURIComponentSafe(segments[index]!);
      decodedSegmentCache[index] = value;
      return value;
    };

    const getSuffixValue = (index: number): string => {
      if (!this.hasWildcardRoutes) {
        return '';
      }
      ensureSuffixCache();
      const raw = (suffixCache && suffixCache[index]) || '';
      if (!shouldDecode) {
        return raw;
      }
      decodedSuffixCache ??= new Array<string | undefined>(segments.length);
      const cached = decodedSuffixCache[index];
      if (cached !== undefined) {
        return cached;
      }
      const value = decodeURIComponentSafe(raw);
      decodedSuffixCache[index] = value;
      return value;
    };

    const paramNames: string[] = [];
    const paramValues: string[] = [];
    let paramCount = 0;
    const pushParam = (name: string, value: string) => {
      paramNames[paramCount] = name;
      paramValues[paramCount] = value;
      paramCount++;
    };

    const cacheKey = this.cache ? this.getCacheKey(method, normalized) : undefined;
    if (cacheKey && this.cache && this.cache.has(cacheKey)) {
      const hit = this.cache.get(cacheKey);
      if (hit === null) {
        return null;
      }
      if (hit) {
        return { key: hit.key, params: hydrateParams(hit.params) };
      }
    }

    const matchDfs = (node: RouterNode, idx: number): RouteKey | null => {
      if (idx === segments.length) {
        const key = node.methods.byMethod.get(method);
        if (key !== undefined) {
          return key;
        }
        return null;
      }
      const seg = segments[idx]!;
      if (node.staticChildren.size) {
        const child = node.staticChildren.get(seg);
        if (child) {
          const parts = child.segmentParts;
          if (parts && parts.length > 1) {
            const matched = matchStaticParts(parts, segments, idx);
            if (matched === parts.length) {
              const k = matchDfs(child, idx + matched);
              if (k !== null) {
                return k;
              }
            }
          } else {
            const k = matchDfs(child, idx + 1);
            if (k !== null) {
              return k;
            }
          }
        }
      }
      if (node.paramChildren.length) {
        for (const c of node.paramChildren) {
          if (c.pattern) {
            continue;
          }
          const prevCount = paramCount;
          pushParam(c.segment, getDecodedSegment(idx));
          const k = matchDfs(c, idx + 1);
          if (k !== null) {
            return k;
          }
          paramCount = prevCount;
        }
        for (const c of node.paramChildren) {
          if (!c.pattern || !c.patternTester!(seg)) {
            continue;
          }
          const prevCount = paramCount;
          pushParam(c.segment, getDecodedSegment(idx));
          const k = matchDfs(c, idx + 1);
          if (k !== null) {
            return k;
          }
          paramCount = prevCount;
        }
      }
      if (node.wildcardChild) {
        const wname = node.wildcardChild.segment || '*';
        const joined = getSuffixValue(idx);
        const prevCount = paramCount;
        pushParam(wname, joined);
        const key = node.wildcardChild.methods.byMethod.get(method);
        if (key !== undefined) {
          return key;
        }
        paramCount = prevCount;
      }
      return null;
    };

    const key = matchDfs(this.root, 0);
    if (key === null) {
      if (cacheKey && this.cache) {
        this.setCache(cacheKey, null);
      }
      return null;
    }

    let snapshotEntries: Array<[string, string]> | undefined;
    const paramsBag =
      paramCount > 0
        ? (() => {
            const bag = Object.create(null) as Record<string, string>;
            if (cacheKey && this.cache) {
              snapshotEntries = new Array(paramCount);
            }
            for (let i = 0; i < paramCount; i++) {
              const name = paramNames[i]!;
              const value = paramValues[i]!;
              bag[name] = value;
              if (snapshotEntries) {
                snapshotEntries[i] = [name, value];
              }
            }
            return bag;
          })()
        : Object.create(null);

    const res: RouteMatch = { key, params: paramsBag };
    if (cacheKey && this.cache) {
      this.setCache(cacheKey, res, snapshotEntries);
    }
    return res;
  }

  private _addSingle(method: HttpMethod, path: string, prepared?: NormalizedPathSegments): RouteKey {
    const preparedPath = prepared ?? normalizeAndSplit(path, this.options);
    const { segments } = preparedPath;
    let firstKey: RouteKey | null = null;
    const addSegments = (node: RouterNode, idx: number): void => {
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
        addSegments(node.wildcardChild, idx + 1);
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
          addSegments(node, idx + 1);
        }
        if (multi) {
          if (idx !== segments.length - 1) {
            throw new Error("Multi-segment param ':name+' must be the last segment");
          }
          if (!node.wildcardChild) {
            node.wildcardChild = new RouterNode(NodeKind.Wildcard, name || '*');
          }
          this.hasWildcardRoutes = true;
          this.hasDynamicRoutes = true;
          addSegments(node.wildcardChild, idx + 1);
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
        }
        addSegments(child, idx + 1);
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
            addSegments(child, idx + matched);
            return;
          }
        }
        addSegments(child, idx + 1);
        return;
      }
      child = new RouterNode(NodeKind.Static, seg);
      node.staticChildren.set(seg, child);
      addSegments(child, idx + 1);
    };
    addSegments(this.root, 0);
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
      prefix = `${method}|`;
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

const DIGIT_PATTERNS = new Set(['\\d+', '\\d{1,}', '[0-9]+', '[0-9]{1,}']);
const ALPHA_PATTERNS = new Set(['[a-zA-Z]+', '[A-Za-z]+']);
const ALPHANUM_PATTERNS = new Set(['[A-Za-z0-9_\\-]+', '[A-Za-z0-9_-]+', '\\w+', '\\w{1,}']);

function matchStaticParts(parts: string[], segments: string[], startIdx: number): number {
  let matched = 0;
  const limit = Math.min(parts.length, segments.length - startIdx);
  while (matched < limit && segments[startIdx + matched] === parts[matched]) {
    matched++;
  }
  return matched;
}

function splitStaticChain(node: RouterNode, splitIndex: number): void {
  const parts = node.segmentParts;
  if (!parts || splitIndex <= 0 || splitIndex >= parts.length) {
    return;
  }
  const prefixParts = parts.slice(0, splitIndex);
  const suffixParts = parts.slice(splitIndex);
  const suffixNode = new RouterNode(NodeKind.Static, suffixParts.length > 1 ? suffixParts.join('/') : suffixParts[0]!);
  if (suffixParts.length > 1) {
    suffixNode.segmentParts = [...suffixParts];
  }
  suffixNode.staticChildren = node.staticChildren;
  suffixNode.paramChildren = node.paramChildren;
  suffixNode.wildcardChild = node.wildcardChild;
  suffixNode.methods = node.methods;

  node.staticChildren = new Map([[suffixParts[0]!, suffixNode]]);
  node.paramChildren = [];
  node.wildcardChild = undefined;
  node.methods = { byMethod: new Map(), version: 0 };
  node.segment = prefixParts.length > 1 ? prefixParts.join('/') : prefixParts[0]!;
  node.segmentParts = prefixParts.length > 1 ? prefixParts : undefined;
}

function hydrateParams(entries?: Array<[string, string]>): Record<string, string> {
  if (!entries || !entries.length) {
    return Object.create(null);
  }
  const bag = Object.create(null) as Record<string, string>;
  for (let i = 0; i < entries.length; i++) {
    const pair = entries[i]!;
    bag[pair[0]] = pair[1];
  }
  return bag;
}

function buildPatternTester(source: string | undefined, compiled: RegExp): (value: string) => boolean {
  if (!source) {
    return value => compiled.test(value);
  }
  if (DIGIT_PATTERNS.has(source)) {
    return isAllDigits;
  }
  if (ALPHA_PATTERNS.has(source)) {
    return isAlpha;
  }
  if (ALPHANUM_PATTERNS.has(source)) {
    return isAlphaNumericDash;
  }
  if (source === '[^/]+') {
    return value => value.length > 0 && value.indexOf('/') === -1;
  }
  return value => compiled.test(value);
}

function isAllDigits(value: string): boolean {
  if (!value.length) {
    return false;
  }
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 48 || code > 57) {
      return false;
    }
  }
  return true;
}

function isAlpha(value: string): boolean {
  if (!value.length) {
    return false;
  }
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    const upper = code >= 65 && code <= 90;
    const lower = code >= 97 && code <= 122;
    if (!upper && !lower) {
      return false;
    }
  }
  return true;
}

function isAlphaNumericDash(value: string): boolean {
  if (!value.length) {
    return false;
  }
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    const upper = code >= 65 && code <= 90;
    const lower = code >= 97 && code <= 122;
    const digit = code >= 48 && code <= 57;
    if (!upper && !lower && !digit && code !== 45 && code !== 95) {
      return false;
    }
  }
  return true;
}
