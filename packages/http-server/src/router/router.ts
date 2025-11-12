import { HttpMethod } from '../enums';
import type { RouteKey } from '../types';

import { NodeKind } from './enums';
import type { Router } from './interfaces';
import { RouterNode } from './node';
import type { RouterOptions, RouteMatch } from './types';
import { normalizePath, splitSegments, decodeURIComponentSafe } from './utils';

let GLOBAL_ROUTE_KEY_SEQ = 1 as RouteKey;

/**
 * Radix-style router (static > param > wildcard precedence)
 * Single-file facade combining the previously split implementation.
 */
export class RadixRouter implements Router {
  private root: RouterNode;
  // Host-based routing: maintain separate roots per host pattern (exact or param-style)
  private hostRoots: Map<string, RouterNode> = new Map();
  private options: Required<RouterOptions>;

  constructor(options?: RouterOptions) {
    this.options = {
      ignoreTrailingSlash: options?.ignoreTrailingSlash ?? true,
      collapseSlashes: options?.collapseSlashes ?? true,
    };
    this.root = new RouterNode(NodeKind.Static, '');
  }

  reset(): void {
    this.root = new RouterNode(NodeKind.Static, '');
  }

  addAll(entries: Array<[HttpMethod, string]>): RouteKey[] {
    const out: RouteKey[] = new Array(entries.length);
    for (let i = 0; i < entries.length; i++) {
      const [m, p] = entries[i]!;
      out[i] = this._addSingle(m, p);
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
    // Host aware single method add delegates to single-path builder after extracting host
    const normalized = normalizePath(path, this.options);
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
      this.root = originalRoot; // restore
      return key;
    }
    return this._addSingle(method, path);
  }

  remove(method: HttpMethod, path: string): boolean {
    const normalized = normalizePath(path, this.options);
    const segments = splitSegments(normalized);

    let node = this.root;
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i]!;
      let next: RouterNode | undefined;
      if (seg.charCodeAt(0) === 42) {
        next = node.wildcardChild;
      } else if (seg.charCodeAt(0) === 58) {
        // Choose param child by name+pattern from the route definition
        // Normalize optional marker if present
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
        } else {
          next = node.paramChildren.find(
            c => c.segment === name && (c.pattern?.source ?? undefined) === (patternSrc ?? undefined),
          );
        }
      } else {
        next = node.staticChildren.get(seg);
      }
      if (!next) {
        return false;
      }
      node = next;
    }
    return node.methods.byMethod.delete(method);
  }

  match(method: HttpMethod, path: string): RouteMatch | null {
    const normalized = normalizePath(path, this.options);
    const segments = splitSegments(normalized);
    const params: Record<string, string> = Object.create(null);

    const matchDfs = (node: RouterNode, idx: number): RouteKey | null => {
      if (idx === segments.length) {
        const key = node.methods.byMethod.get(method);
        if (key !== undefined) {
          return key;
        }
        return null;
      }

      const seg = segments[idx]!;

      const staticNext = node.staticChildren.get(seg);
      if (staticNext) {
        const k = matchDfs(staticNext, idx + 1);
        if (k !== null) {
          return k;
        }
      }

      if (node.paramChildren.length) {
        for (const c of node.paramChildren) {
          if (c.pattern && !c.pattern.test(seg)) {
            continue;
          }
          const prev = params[c.segment];
          params[c.segment] = decodeURIComponentSafe(seg);
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
        params[wname] = decodeURIComponentSafe(segments.slice(idx).join('/'));
        const key = node.wildcardChild.methods.byMethod.get(method);
        if (key !== undefined) {
          return key;
        }
      }
      return null;
    };

    // If host-based roots exist, allow host prefix match using Host header pattern embedded in path as '@host/...'
    // Expect caller to prepend '@actual.host' or '@sub.example.com'; if absent, fall back to default root.
    let startNode = this.root;
    if (segments.length && segments[0]!.charCodeAt(0) === 64 /* '@' */) {
      const hostSeg = segments[0]!.slice(1);
      segments.shift();
      // Try exact first
      if (this.hostRoots.has(hostSeg)) {
        startNode = this.hostRoots.get(hostSeg)!;
      } else {
        // Param-like host patterns (e.g., ':sub.example.com')
        for (const [pat, root] of this.hostRoots.entries()) {
          if (pat.charCodeAt(0) === 58 /* ':' */) {
            // Simple wildcard for subdomain segment before first '.'
            const dotIndex = pat.indexOf('.');
            if (dotIndex > 0) {
              const suffix = pat.slice(dotIndex); // '.example.com'
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
      return null;
    }
    return { key, params };
  }

  allowed(path: string): HttpMethod[] {
    const normalized = normalizePath(path, this.options);
    const segments = splitSegments(normalized);
    const methods = new Set<HttpMethod>();

    const dfs = (node: RouterNode, idx: number) => {
      if (idx === segments.length) {
        for (const m of node.methods.byMethod.keys()) {
          methods.add(m);
        }
        return true;
      }
      const seg = segments[idx]!;
      const staticNext = node.staticChildren.get(seg);
      if (staticNext) {
        if (dfs(staticNext, idx + 1)) {
          return true;
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

  // Keep private builder after all public APIs to satisfy member-ordering linter
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
      if (!child) {
        child = new RouterNode(NodeKind.Static, seg);
        node.staticChildren.set(seg, child);
      }
      addSegments(child, idx + 1);
    };
    addSegments(this.root, 0);
    return firstKey!;
  }
}

export default RadixRouter;
