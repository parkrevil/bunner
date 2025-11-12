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
    // Use recursive builder to support optional params branching
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

      if (seg === '*') {
        if (idx !== segments.length - 1) {
          throw new Error("Wildcard '*' must be the last segment");
        }
        if (!node.wildcardChild) {
          node.wildcardChild = new RouterNode(NodeKind.Wildcard, '*');
        }
        // Leaf will be set in the next recursion step
        addSegments(node.wildcardChild, idx + 1);
        return;
      }

      if (seg.charCodeAt(0) === 58 /* ':' */) {
        // Optional param support: ":name?" (no regex with ? in this iteration)
        let optional = false;
        let core = seg;
        if (seg.endsWith('?')) {
          optional = true;
          core = seg.slice(0, -1);
        }

        // Support ":name" and ":name{regex}"
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

        // If optional, branch that skips this segment entirely
        if (optional) {
          addSegments(node, idx + 1);
        }

        // Find or create a param child matching name+pattern
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
    // At least one key must have been created

    return firstKey!;
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
        // Choose param child by name+pattern from the route definition
        // Normalize optional marker if present
        const s = seg.endsWith('?') ? seg.slice(0, -1) : seg;
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
        next = node.paramChildren.find(c => c.segment === name && (c.pattern?.source ?? undefined) === (patternSrc ?? undefined));
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

    dfs(this.root, 0);
    return Array.from(methods.values());
  }
}

export default RadixRouter;
