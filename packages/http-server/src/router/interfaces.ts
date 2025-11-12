import type { HttpMethod } from '../enums';
import type { RouteKey } from '../types';

import type { RouterOptions, RouteMatch } from './types';

export interface Router {
  add(method: HttpMethod | HttpMethod[] | '*', path: string): RouteKey | RouteKey[];
  addAll(entries: Array<[HttpMethod, string]>): RouteKey[];
  match(method: HttpMethod, path: string): RouteMatch | null;
  /** Return methods available at matched path (ignoring method) — useful for 405 */
  allowed(path: string): HttpMethod[];
  remove(method: HttpMethod, path: string): boolean;
  /** Check if a route exists; if method omitted, checks any method */
  has(path: string, method?: HttpMethod): boolean;
  /** List all routes (path pattern and methods) for introspection */
  list(): Array<{ path: string; methods: HttpMethod[] }>;
  /** Serialize the router trie for persistence or hot-reload */
  snapshot(): unknown;
  /** Restore a router from a previous snapshot */
  restore(data: unknown): void;
  reset(): void;
}

export interface RouteMethods {
  /** Per-method registered route keys at this node (leaf) */
  byMethod: Map<HttpMethod, RouteKey>;
}

export interface RouterConstructor<T extends Router = Router> {
  new (options?: RouterOptions): T;
}
