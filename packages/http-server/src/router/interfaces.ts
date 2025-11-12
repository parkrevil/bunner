import type { HttpMethod } from '../enums';
import type { RouteKey } from '../types';

import type { RouterOptions, RouteMatch } from './types';

export interface Router {
  add(method: HttpMethod, path: string): RouteKey;
  addAll(entries: Array<[HttpMethod, string]>): RouteKey[];
  match(method: HttpMethod, path: string): RouteMatch | null;
  /** Return methods available at matched path (ignoring method) — useful for 405 */
  allowed(path: string): HttpMethod[];
  remove(method: HttpMethod, path: string): boolean;
  reset(): void;
}

export interface RouteMethods {
  /** Per-method registered route keys at this node (leaf) */
  byMethod: Map<HttpMethod, RouteKey>;
}

export interface RouterConstructor<T extends Router = Router> {
  new (options?: RouterOptions): T;
}
