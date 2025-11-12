import { HttpMethod } from '../enums';
import type { RouteKey } from '../types';

import { NodeKind } from './enums';
import type { Router } from './interfaces';
import { RouterNode } from './node';
import type { RouterOptions, RouteMatch } from './types';
import { normalizePath, splitSegments, decodeURIComponentSafe } from './utils';

let GLOBAL_ROUTE_KEY_SEQ = 1 as RouteKey;

export class RadixRouter implements Router {
  private root: RouterNode;
  private hostRoots: Map<string, RouterNode> = new Map();
  private options: Required<RouterOptions>;
  private cache?: Map<string, RouteMatch | null>;
  private staticFast: Map<string, Map<HttpMethod, RouteKey>> = new Map();

  constructor(options?: RouterOptions) {
    this.options = {
      ignoreTrailingSlash: options?.ignoreTrailingSlash ?? true,
      collapseSlashes: options?.collapseSlashes ?? true,
      caseSensitive: options?.caseSensitive ?? true,
      redirectTrailingSlash: options?.redirectTrailingSlash ?? 'off',
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

  reset(): void {
    this.root = new RouterNode(NodeKind.Static, '');
    if (this.cache) {
      this.cache.clear();
    }
    this.staticFast.clear();
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
    this.compressStaticPaths();
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
    let normalized = normalizePath(path, this.options);
    if (!this.options.caseSensitive) {
      normalized = normalized.toLowerCase();
    }
    const segments = splitSegments(normalized);
    if (segments.length && segments[0]!.charCodeAt(0) === 64 /* '@' */) {
      const hostSeg = segments[0]!.slice(1);
      segments.shift();
      if (!this.hostRoots.has(hostSeg)) {
        this.hostRoots.set(hostSeg, new RouterNode(NodeKind.Static, ''));
      }
      const originalRoot = this.root;
      this.root = this.hostRoots.get(hostSeg)!;
      const key = this._addSingle(method, '/' + segments.join('/'));
      this.root = originalRoot;
      this.compressStaticPaths();
      return key;
    }
    const k = this._addSingle(method, path);
    this.compressStaticPaths();
    return k;
  }

  remove(method: HttpMethod, path: string): boolean {
    let normalized = normalizePath(path, this.options);
    if (!this.options.caseSensitive) {
      normalized = normalized.toLowerCase();
    }
    // remove from static fast-path
    const by = this.staticFast.get(normalized);
    if (by) {
      by.delete(method);
      if (by.size === 0) {
        this.staticFast.delete(normalized);
      }
    }
    const segments = splitSegments(normalized);
    const stack: Array<{ parent: RouterNode; type: 'static' | 'param' | 'wildcard'; key?: string; child: RouterNode }> = [];
    let node = this.root;
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i]!;
      let next: RouterNode | undefined;
      let type: 'static' | 'param' | 'wildcard' = 'static';
      let keySeg: string | undefined;
      if (seg.charCodeAt(0) === 42) {
        // '*'
        next = node.wildcardChild;
        type = 'wildcard';
      } else if (seg.charCodeAt(0) === 58) {
        // ':'
        let s = seg.endsWith('?') ? seg.slice(0, -1) : seg;
        const isMulti = s.endsWith('+');
        if (isMulti) {
          s = s.slice(0, -1);
        }
        const brace = s.indexOf('{');
        let name = '';
        let patternSrc: string | undefined;
        if (brace === -1) {
          name = s.slice(1);
        } else {
          name = s.slice(1, brace);
          if (!s.endsWith('}')) {
            return false;
          }
          patternSrc = s.slice(brace + 1, -1) || undefined;
        }
        if (isMulti) {
          next = node.wildcardChild;
          type = 'wildcard';
        } else {
          next = node.paramChildren.find(
            c => c.segment === name && (c.pattern?.source ?? undefined) === (patternSrc ?? undefined),
          );
          type = 'param';
        }
      } else {
        next = node.staticChildren.get(seg);
        keySeg = seg;
        type = 'static';
        if (!next && node.staticChildren.size) {
          for (const child of node.staticChildren.values()) {
            const parts = child.segmentParts ?? [child.segment];
            if (parts[0] !== seg) {
              continue;
            }
            let j = 1;
            while (j < parts.length && i + j < segments.length && segments[i + j] === parts[j]) {
              j++;
            }
            if (j === parts.length) {
              next = child;
              i += j - 1;
              keySeg = parts[0];
              break;
            }
          }
        }
      }
      if (!next) {
        return false;
      }
      stack.push({ parent: node, type, key: keySeg, child: next });
      node = next;
    }
    const removed = node.methods.byMethod.delete(method);
    if (!removed) {
      return false;
    }
    for (let i = stack.length - 1; i >= 0; i--) {
      const { parent, type, key, child } = stack[i]!;
      const empty =
        child.methods.byMethod.size === 0 &&
        child.staticChildren.size === 0 &&
        child.paramChildren.length === 0 &&
        !child.wildcardChild;
      if (empty) {
        if (type === 'static' && key !== undefined) {
          parent.staticChildren.delete(key);
        } else if (type === 'param') {
          parent.paramChildren = parent.paramChildren.filter(n => n !== child);
        } else if (type === 'wildcard') {
          parent.wildcardChild = undefined;
        }
      } else {
        break;
      }
    }
    if (this.cache) {
      this.cache.clear();
    }
    return true;
  }

  match(method: HttpMethod, path: string): RouteMatch | null {
    let normalized = normalizePath(path, this.options);
    if (!this.options.caseSensitive) {
      normalized = normalized.toLowerCase();
    }
    // static fast-path lookup
    const fast = this.staticFast.get(normalized);
    if (fast) {
      const k = fast.get(method);
      if (k !== undefined) {
        return { key: k, params: {} };
      }
    }
    let segments = splitSegments(normalized);
    const params: Record<string, string> = Object.create(null);
    const cacheKey = `${method} ${segments.join('/')}`;
    if (this.cache && this.cache.has(cacheKey)) {
      const hit = this.cache.get(cacheKey);
      if (hit === null) {
        return null;
      }
      if (hit) {
        return { key: hit.key, params: { ...hit.params }, redirectTo: hit.redirectTo };
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
          const parts = child.segmentParts ?? [child.segment];
          if (parts[0] !== seg) {
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
          const prev = params[c.segment];
          params[c.segment] = this.options.decodeParams ? decodeURIComponentSafe(seg) : seg;
          const k = matchDfs(c, idx + 1);
          if (k !== null) {
            return k;
          }
          if (prev === undefined) {
            delete params[c.segment];
          } else {
            params[c.segment] = prev;
          }
        }
      }
      if (node.wildcardChild) {
        const wname = node.wildcardChild.segment || '*';
        const joined = segments.slice(idx).join('/');
        params[wname] = this.options.decodeParams ? decodeURIComponentSafe(joined) : joined;
        const key = node.wildcardChild.methods.byMethod.get(method);
        if (key !== undefined) {
          return key;
        }
      }
      return null;
    };

    let startNode = this.root;
    if (segments.length && segments[0]!.charCodeAt(0) === 64 /* '@' */) {
      const hostSeg = segments[0]!.slice(1);
      segments.shift();
      if (this.hostRoots.has(hostSeg)) {
        startNode = this.hostRoots.get(hostSeg)!;
      } else {
        for (const [pat, root] of this.hostRoots.entries()) {
          if (pat.charCodeAt(0) === 58 /* ':' */) {
            const dotIndex = pat.indexOf('.');
            if (dotIndex > 0) {
              const suffix = pat.slice(dotIndex);
              if (hostSeg.endsWith(suffix)) {
                startNode = root;
                break;
              }
            }
          }
        }
      }
    }
    const key = matchDfs(startNode, 0);
    if (key === null) {
      const pol = this.options.redirectTrailingSlash;
      if (pol && pol !== 'off') {
        const had = path.length > 1 && path.endsWith('/');
        let targetPath = path;
        if (pol === 'remove' || (pol === 'auto' && had)) {
          if (had) {
            targetPath = path.slice(0, -1);
          }
        } else if (pol === 'add' || (pol === 'auto' && !had)) {
          if (!had) {
            targetPath = path + '/';
          }
        }
        if (targetPath !== path) {
          let alt = normalizePath(targetPath, { ignoreTrailingSlash: false, collapseSlashes: this.options.collapseSlashes });
          if (!this.options.caseSensitive) {
            alt = alt.toLowerCase();
          }
          const altSegments = splitSegments(alt);
          segments = altSegments;
          const altKey = matchDfs(startNode, 0);
          if (altKey !== null) {
            const res: RouteMatch = { key: altKey, params, redirectTo: targetPath };
            if (this.cache) {
              this.setCache(cacheKey, res);
            }
            return res;
          }
        }
      }
      if (this.cache) {
        this.setCache(cacheKey, null);
      }
      return null;
    }
    const res: RouteMatch = { key, params };
    if (this.cache) {
      this.setCache(cacheKey, res);
    }
    return res;
  }

  allowed(path: string): HttpMethod[] {
    let normalized = normalizePath(path, this.options);
    if (!this.options.caseSensitive) {
      normalized = normalized.toLowerCase();
    }
    const segments = splitSegments(normalized);
    const methods = new Set<HttpMethod>();
    const dfs = (node: RouterNode, idx: number): boolean => {
      if (idx === segments.length) {
        for (const m of node.methods.byMethod.keys()) {
          methods.add(m);
        }
        return true;
      }
      const seg = segments[idx]!;
      if (node.staticChildren.size) {
        const direct = node.staticChildren.get(seg);
        if (direct && dfs(direct, idx + 1)) {
          return true;
        }
        for (const child of node.staticChildren.values()) {
          const parts = child.segmentParts ?? [child.segment];
          if (parts[0] !== seg) {
            continue;
          }
          let j = 1;
          while (j < parts.length && idx + j < segments.length && segments[idx + j] === parts[j]) {
            j++;
          }
          if (j === parts.length && dfs(child, idx + j)) {
            return true;
          }
        }
      }
      if (node.paramChildren.length) {
        for (const c of node.paramChildren) {
          if (dfs(c, idx + 1)) {
            return true;
          }
        }
      }
      if (node.wildcardChild) {
        for (const m of node.wildcardChild.methods.byMethod.keys()) {
          methods.add(m);
        }
        return true;
      }
      return false;
    };
    let startNode = this.root;
    if (segments.length && segments[0]!.charCodeAt(0) === 64 /* '@' */) {
      const hostSeg = segments[0]!.slice(1);
      segments.shift();
      if (this.hostRoots.has(hostSeg)) {
        startNode = this.hostRoots.get(hostSeg)!;
      }
    }
    dfs(startNode, 0);
    return Array.from(methods.values());
  }

  has(path: string, method?: HttpMethod): boolean {
    if (method === undefined) {
      return this.allowed(path).length > 0;
    }
    const m = this.match(method, path);
    return m !== null;
  }

  list(): Array<{ path: string; methods: HttpMethod[] }> {
    const results: Array<{ path: string; methods: HttpMethod[] }> = [];
    const pushIfMethods = (p: string, node: RouterNode) => {
      if (node.methods.byMethod.size) {
        results.push({ path: p || '/', methods: Array.from(node.methods.byMethod.keys()) });
      }
    };
    const walk = (prefix: string, node: RouterNode) => {
      pushIfMethods(prefix, node);
      // static children
      for (const [, child] of node.staticChildren) {
        const parts = child.segmentParts ?? [child.segment];
        const next = prefix === '/' || prefix === '' ? `/${parts.join('/')}` : `${prefix}/${parts.join('/')}`;
        walk(next, child);
      }
      // params
      for (const child of node.paramChildren) {
        const seg = `:${child.segment}${child.pattern ? '{' + child.pattern.source.replace(/^(?:\^\(\?:)?|\$\)?$/g, '') + '}' : ''}`;
        const next = prefix === '/' || prefix === '' ? `/${seg}` : `${prefix}/${seg}`;
        walk(next, child);
      }
      // wildcard
      if (node.wildcardChild) {
        const name = node.wildcardChild.segment || '*';
        const seg = name === '*' ? '*' : `*${name}`;
        const next = prefix === '/' || prefix === '' ? `/${seg}` : `${prefix}/${seg}`;
        walk(next, node.wildcardChild);
      }
    };
    // default root
    walk('', this.root);
    // host roots
    for (const [host, root] of this.hostRoots) {
      walk(`@${host}`, root);
    }
    return results;
  }

  snapshot(): unknown {
    const serNode = (node: RouterNode): any => ({
      k: node.kind,
      s: node.segment,
      sp: node.segmentParts,
      p: node.pattern?.source,
      m: Array.from(node.methods.byMethod.entries()),
      sc: Array.from(node.staticChildren.values()).map(serNode),
      pc: node.paramChildren.map(serNode),
      wc: node.wildcardChild ? serNode(node.wildcardChild) : undefined,
    });
    return {
      root: serNode(this.root),
      hosts: Array.from(this.hostRoots.entries()).map(([h, r]) => [h, serNode(r)] as const),
      options: this.options,
    };
  }

  restore(data: unknown): void {
    const d = data as any;
    const revive = (n: any): RouterNode => {
      const node = new RouterNode(n.k, n.s);
      if (n.sp) {
        node.segmentParts = n.sp;
      }
      if (n.p) {
        node.pattern = new RegExp(n.p);
      }
      for (const [m, key] of n.m as Array<[HttpMethod, RouteKey]>) {
        node.methods.byMethod.set(m, key);
      }
      for (const c of n.sc as any[]) {
        const child = revive(c);
        node.staticChildren.set(child.segment, child);
      }
      for (const c of n.pc as any[]) {
        node.paramChildren.push(revive(c));
      }
      if (n.wc) {
        node.wildcardChild = revive(n.wc);
      }
      return node;
    };
    this.root = revive(d.root);
    this.hostRoots.clear();
    for (const [h, r] of d.hosts as Array<[string, any]>) {
      this.hostRoots.set(h, revive(r));
    }
    this.staticFast.clear();
    if (this.cache) {
      this.cache.clear();
    }
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
        const parts: string[] = [child.segment];
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
          parts.push(next.segment);
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

  private setCache(key: string, value: RouteMatch | null): void {
    if (!this.cache) {
      return;
    }
    // LRU discipline via delete+set
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    this.cache.set(key, value);
    if (this.cache.size > this.options.cacheSize) {
      const first = this.cache.keys().next().value;
      if (first !== undefined) {
        this.cache.delete(first);
      }
    }
  }
}

export default RadixRouter;
