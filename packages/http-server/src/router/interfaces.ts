import type { HttpMethod } from '../enums';
import type { RouteKey } from '../types';

import type { RouterOptions, RouteMatch } from './types';

export interface Router {
  add(method: HttpMethod | HttpMethod[] | '*', path: string): RouteKey | RouteKey[];
  addAll(entries: Array<[HttpMethod, string]>): RouteKey[];
  match(method: HttpMethod, path: string): RouteMatch | null;
}

export interface RouteMethods {
  /** Per-method registered route keys at this node (leaf) */
  byMethod: Map<HttpMethod, RouteKey>;
}

export interface RouterConstructor<T extends Router = Router> {
  new (options?: RouterOptions): T;
}
