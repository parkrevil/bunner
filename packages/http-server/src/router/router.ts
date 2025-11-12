import type { HttpMethod } from '../enums';
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
      out[i] = this.add(m, p);
    }
    return out;
  }

  add(method: HttpMethod, path: string): RouteKey {
    const normalized = normalizePath(path, this.options);
    const segments = splitSegments(normalized);

    let node = this.root;
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i]!;

      if (seg === '*') {
        if (i !== segments.length - 1) {
          throw new Error("Wildcard '*' must be the last segment");
        }
        if (!node.wildcardChild) {
          node.wildcardChild = new RouterNode(NodeKind.Wildcard, '*');
        }
        node = node.wildcardChild;
        break;
      }

      if (seg.charCodeAt(0) === 58 /* ':' */) {
        const name = seg.slice(1);
        if (!name) {
          throw new Error("Parameter segment must have a name, eg ':id'");
        }
        if (!node.paramChild) {
          node.paramChild = new RouterNode(NodeKind.Param, name);
        } else if (node.paramChild.segment !== name) {
          // allow different param names at same position; keep first
        }
        node = node.paramChild;
        continue;
      }

      let child = node.staticChildren.get(seg);
      if (!child) {
        child = new RouterNode(NodeKind.Static, seg);
        node.staticChildren.set(seg, child);
      }
      node = child;
    }

    const existing = node.methods.byMethod.get(method);
    if (existing !== undefined) {
      throw new Error(`Route already exists for method at path: ${path}`);
    }
    const key = GLOBAL_ROUTE_KEY_SEQ++ as unknown as RouteKey;
    node.methods.byMethod.set(method, key);
    return key;
  }

  remove(method: HttpMethod, path: string): boolean {
    const normalized = normalizePath(path, this.options);
    const segments = splitSegments(normalized);

    let node = this.root;
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i]!;
      let next: RouterNode | undefined;
      if (seg === '*') {
        next = node.wildcardChild;
      } else if (seg.charCodeAt(0) === 58) {
        next = node.paramChild;
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

      if (node.paramChild) {
        const prev = params[node.paramChild.segment];
        params[node.paramChild.segment] = decodeURIComponentSafe(seg);
        const k = matchDfs(node.paramChild, idx + 1);
        if (k !== null) {
          return k;
        }
        if (prev === undefined) {
          delete params[node.paramChild.segment];
        } else {
          params[node.paramChild.segment] = prev;
        }
      }

      if (node.wildcardChild) {
        params['*'] = decodeURIComponentSafe(segments.slice(idx).join('/'));
        const key = node.wildcardChild.methods.byMethod.get(method);
        if (key !== undefined) {
          return key;
        }
      }
      return null;
    };

    const key = matchDfs(this.root, 0);
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
      if (node.paramChild) {
        if (dfs(node.paramChild, idx + 1)) {
          return true;
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

    dfs(this.root, 0);
    return Array.from(methods.values());
  }
}

export default RadixRouter;
