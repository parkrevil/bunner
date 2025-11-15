import { HttpMethod } from '../enums';
import type { RouteKey } from '../types';

import { NodeKind } from './enums';
import type { RouteMethods, Router } from './interfaces';
import { RouterNode } from './node';
import type { RouterOptions, RouteMatch } from './types';
import { normalizePath, splitSegments, decodeURIComponentSafe } from './utils';

let GLOBAL_ROUTE_KEY_SEQ = 1 as RouteKey;

export class RadixRouter implements Router {
  private root: RouterNode;
  private options: Required<RouterOptions>;
  private cache?: Map<string, RouteMatch | null>;
  private staticFast: Map<string, Map<HttpMethod, RouteKey>> = new Map();
  private needsCompression = false;
  private cacheKeyPrefixes: Record<number, string> = Object.create(null);
  private cacheKeyPool?: Map<number, Map<string, string>>;
  private cacheKeyPoolLimit: number;
  private lastCacheKeyMethod?: HttpMethod;
  private lastCacheKeyPath?: string;
  private lastCacheKeyValue?: string;

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
    this.cacheKeyPoolLimit = Math.max(512, this.options.cacheSize * 2);
    if (this.options.enableCache) {
      this.cache = new Map();
    }
  }

  addAll(entries: Array<[HttpMethod, string]>): RouteKey[] {
    const out: RouteKey[] = new Array(entries.length);
    for (let i = 0; i < entries.length; i++) {
      const [m, p] = entries[i]!;
      out[i] = this._addSingle(m, p);
      // static fast-path table update
      const norm = normalizePath(p, this.options);
      if (!this.options.caseSensitive) {
        // fast table uses normalized, case-processed key same as match
        const keyPath = norm.toLowerCase();
        if (p.indexOf(':') === -1 && p.indexOf('*') === -1) {
          let by = this.staticFast.get(keyPath);
          if (!by) {
            by = new Map();
            this.staticFast.set(keyPath, by);
          }
          by.set(m, out[i]!);
        }
      } else {
        if (p.indexOf(':') === -1 && p.indexOf('*') === -1) {
          let by = this.staticFast.get(norm);
          if (!by) {
            by = new Map();
            this.staticFast.set(norm, by);
          }
          by.set(m, out[i]!);
        }
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
    const k = this._addSingle(method, path);
    if (path.indexOf(':') === -1 && path.indexOf('*') === -1) {
      const norm = normalizePath(path, this.options);
      const keyPath = this.options.caseSensitive ? norm : norm.toLowerCase();
      let by = this.staticFast.get(keyPath);
      if (!by) {
        by = new Map();
        this.staticFast.set(keyPath, by);
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
    const normalized = normalizePath(path, this.options);
    // static fast-path lookup
    const fast = this.staticFast.get(normalized);
    if (fast) {
      const k = fast.get(method);
      if (k !== undefined) {
        return { key: k, params: {} };
      }
    }
    const segments = splitSegments(normalized);
    const suffixCache: string[] = [];
    if (segments.length) {
      let suffix = '';
      for (let i = segments.length - 1; i >= 0; i--) {
        suffix = suffix ? `${segments[i]!}/${suffix}` : segments[i]!;
        suffixCache[i] = suffix;
      }
    }
    const decodedSegmentCache = this.options.decodeParams ? new Array<string | undefined>(segments.length) : undefined;
    const decodedSuffixCache = this.options.decodeParams ? new Array<string | undefined>(segments.length) : undefined;
    const getDecodedSegment = (index: number): string => {
      if (!this.options.decodeParams) {
        return segments[index]!;
      }
      const cached = decodedSegmentCache![index];
      if (cached !== undefined) {
        return cached;
      }
      const value = decodeURIComponentSafe(segments[index]!);
      decodedSegmentCache![index] = value;
      return value;
    };
    const getSuffixValue = (index: number): string => {
      const raw = suffixCache[index] ?? '';
      if (!this.options.decodeParams || index >= segments.length) {
        return raw;
      }
      const cached = decodedSuffixCache![index];
      if (cached !== undefined) {
        return cached;
      }
      const value = decodeURIComponentSafe(raw);
      decodedSuffixCache![index] = value;
      return value;
    };
    let params: Record<string, string> | null = null;
    const ensureParams = (): Record<string, string> => {
      if (params === null) {
        params = Object.create(null);
      }
      return params as Record<string, string>;
    };
    const cacheKey = this.cache ? this.getCacheKey(method, normalized) : undefined;
    if (cacheKey && this.cache && this.cache.has(cacheKey)) {
      const hit = this.cache.get(cacheKey);
      if (hit === null) {
        return null;
      }
      if (hit) {
        return { key: hit.key, params: { ...hit.params } };
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
        const direct = node.staticChildren.get(seg);
        if (direct) {
          const k = matchDfs(direct, idx + 1);
          if (k !== null) {
            return k;
          }
        }
        for (const child of node.staticChildren.values()) {
          const parts = child.segmentParts;
          if (!parts || parts.length <= 1 || parts[0] !== seg) {
            continue;
          }
          let j = 1;
          while (j < parts.length && idx + j < segments.length && segments[idx + j] === parts[j]) {
            j++;
          }
          if (j === parts.length) {
            const k = matchDfs(child, idx + j);
            if (k !== null) {
              return k;
            }
          }
        }
      }
      if (node.paramChildren.length) {
        for (const c of node.paramChildren) {
          if (c.pattern && !c.pattern.test(seg)) {
            continue;
          }
          const k = matchDfs(c, idx + 1);
          if (k !== null) {
            const bag = ensureParams();
            bag[c.segment] = getDecodedSegment(idx);
            return k;
          }
        }
      }
      if (node.wildcardChild) {
        const wname = node.wildcardChild.segment || '*';
        const joined = getSuffixValue(idx);
        const bag = ensureParams();
        bag[wname] = joined;
        const key = node.wildcardChild.methods.byMethod.get(method);
        if (key !== undefined) {
          return key;
        }
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
    const finalParams = params ?? Object.create(null);
    const res: RouteMatch = { key, params: finalParams };
    if (cacheKey && this.cache) {
      this.setCache(cacheKey, res);
    }
    return res;
  }

  list(): Array<{ path: string; methods: HttpMethod[] }> {
    this.ensureCompressed();

    type Frame = {
      node: RouterNode;
      depth: number;
      visitedSelf: boolean;
      staticChildren: RouterNode[];
      staticIndex: number;
      paramIndex: number;
      wildcardHandled: boolean;
    };

    const results: Array<{ path: string; methods: HttpMethod[] }> = [];
    const stack: Frame[] = [];
    const framePool: Frame[] = [];
    const EMPTY_STATIC: RouterNode[] = [];
    const pathSegments: string[] = [];

    const acquireFrame = (): Frame => {
      if (framePool.length) {
        return framePool.pop()!;
      }
      return {
        node: this.root,
        depth: 0,
        visitedSelf: false,
        staticChildren: EMPTY_STATIC,
        staticIndex: 0,
        paramIndex: 0,
        wildcardHandled: true,
      };
    };

    const releaseFrame = (frame: Frame) => {
      frame.staticChildren = EMPTY_STATIC;
      framePool.push(frame);
    };

    const getStaticSnapshot = (node: RouterNode): RouterNode[] => {
      if (node.staticChildren.size === 0) {
        return EMPTY_STATIC;
      }
      if (!node.cachedStaticChildren || node.cachedStaticChildrenVersion !== node.staticChildrenVersion) {
        node.cachedStaticChildren = Array.from(node.staticChildren.values());
        node.cachedStaticChildren.sort((a, b) => {
          const depthDelta = (a.compressionDepth ?? 1) - (b.compressionDepth ?? 1);
          if (depthDelta !== 0) {
            return depthDelta;
          }
          if (a.segment.length !== b.segment.length) {
            return a.segment.length - b.segment.length;
          }
          return a.segment < b.segment ? -1 : a.segment > b.segment ? 1 : 0;
        });
        node.cachedStaticChildrenVersion = node.staticChildrenVersion;
      }
      return node.cachedStaticChildren;
    };

    const pushFrame = (node: RouterNode, depth: number) => {
      const frame = acquireFrame();
      frame.node = node;
      frame.depth = depth;
      frame.visitedSelf = false;
      frame.staticChildren = getStaticSnapshot(node);
      frame.staticIndex = 0;
      frame.paramIndex = 0;
      frame.wildcardHandled = !node.wildcardChild;
      stack.push(frame);
    };

    const buildCurrentPath = (depth: number): string => {
      if (depth === 0) {
        return '/';
      }
      let out = '';
      for (let i = 0; i < depth; i++) {
        out += '/' + pathSegments[i]!;
      }
      return out;
    };

    pushFrame(this.root, 0);
    while (stack.length) {
      const frame = stack[stack.length - 1]!;
      if (!frame.visitedSelf) {
        if (frame.node.methods.byMethod.size) {
          results.push({ path: buildCurrentPath(frame.depth), methods: getCachedMethodList(frame.node.methods) });
        }
        frame.visitedSelf = true;
        continue;
      }
      if (frame.staticIndex < frame.staticChildren.length) {
        const child = frame.staticChildren[frame.staticIndex++]!;
        pathSegments[frame.depth] = child.segment;
        pushFrame(child, frame.depth + 1);
        continue;
      }
      if (frame.paramIndex < frame.node.paramChildren.length) {
        const child = frame.node.paramChildren[frame.paramIndex++]!;
        const rawPattern =
          child.patternSource ?? (child.pattern ? child.pattern.source.replace(/^\^\(\?:/, '').replace(/\)\$$/, '') : undefined);
        const seg = `:${child.segment}${rawPattern ? `{${rawPattern}}` : ''}`;
        pathSegments[frame.depth] = seg;
        pushFrame(child, frame.depth + 1);
        continue;
      }
      if (!frame.wildcardHandled) {
        frame.wildcardHandled = true;
        const child = frame.node.wildcardChild!;
        const name = child.segment || '*';
        const seg = name === '*' ? '*' : `*${name}`;
        pathSegments[frame.depth] = seg;
        pushFrame(child, frame.depth + 1);
        continue;
      }
      stack.pop();
      releaseFrame(frame);
    }
    return results;
  }

  private _addSingle(method: HttpMethod, path: string): RouteKey {
    const normalized = normalizePath(path, this.options);
    const segments = splitSegments(normalized);
    let firstKey: RouteKey | null = null;
    const addSegments = (node: RouterNode, idx: number): void => {
      if (idx === segments.length) {
        const existing = node.methods.byMethod.get(method);
        if (existing !== undefined) {
          throw new Error(`Route already exists for method at path: ${path}`);
        }
        const key = GLOBAL_ROUTE_KEY_SEQ++ as unknown as RouteKey;
        node.methods.byMethod.set(method, key);
        node.methods.listCache = undefined;
        node.methods.listCacheVersion = undefined;
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
        addSegments(node.wildcardChild, idx + 1);
        return;
      }
      if (seg.charCodeAt(0) === 58 /* ':' */) {
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
      if (!child) {
        child = new RouterNode(NodeKind.Static, seg);
        node.staticChildren.set(seg, child);
        node.staticChildrenVersion++;
        node.cachedStaticChildren = undefined;
        node.cachedStaticChildrenVersion = -1;
      }
      addSegments(child, idx + 1);
    };
    addSegments(this.root, 0);
    return firstKey!;
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
          child.staticChildrenVersion = cursor.staticChildrenVersion;
          child.cachedStaticChildren = cursor.cachedStaticChildren;
          child.cachedStaticChildrenVersion = cursor.cachedStaticChildrenVersion;
          child.paramChildren = cursor.paramChildren;
          child.wildcardChild = cursor.wildcardChild;
          child.methods = cursor.methods;
          child.compressionDepth = parts.length;
        } else {
          child.segmentParts = undefined;
          child.compressionDepth = 1;
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

  private setCache(key: string, value: RouteMatch | null): void {
    if (!this.cache) {
      return;
    }
    // LRU discipline via delete+set
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    const snapshot = value ? { key: value.key, params: { ...value.params } } : null;
    this.cache.set(key, snapshot);
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
    let methodPool: Map<string, string> | undefined;
    if (this.cacheKeyPool) {
      methodPool = this.cacheKeyPool.get(method as number);
    }
    if (!methodPool) {
      methodPool = new Map();
      if (!this.cacheKeyPool) {
        this.cacheKeyPool = new Map();
      }
      this.cacheKeyPool.set(method as number, methodPool);
    }
    const existing = methodPool.get(normalizedKey);
    if (existing) {
      this.lastCacheKeyMethod = method;
      this.lastCacheKeyPath = normalizedKey;
      this.lastCacheKeyValue = existing;
      return existing;
    }
    let prefix = this.cacheKeyPrefixes[method as number];
    if (!prefix) {
      prefix = `${method} `;
      this.cacheKeyPrefixes[method as number] = prefix;
    }
    const key = prefix + normalizedKey;
    if (methodPool.size >= this.cacheKeyPoolLimit) {
      methodPool.clear();
    }
    methodPool.set(normalizedKey, key);
    this.lastCacheKeyMethod = method;
    this.lastCacheKeyPath = normalizedKey;
    this.lastCacheKeyValue = key;
    return key;
  }
}

function getCachedMethodList(methods: RouteMethods): HttpMethod[] {
  const cached = methods.listCache;
  if (cached && methods.listCacheVersion === methods.version) {
    return cached;
  }
  const size = methods.byMethod.size;
  const next = new Array<HttpMethod>(size);
  let i = 0;
  for (const key of methods.byMethod.keys()) {
    next[i++] = key;
  }
  methods.listCache = next;
  methods.listCacheVersion = methods.version;
  return next;
}

export default RadixRouter;
