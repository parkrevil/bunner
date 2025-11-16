import type { HttpMethod } from '../enums';
import type { RouteKey } from '../types';

import type { RouterOptions, RouteMatch } from './types';

export interface RouterInstance {
  match(method: HttpMethod, path: string): RouteMatch | null;
}

export interface RouterBuilder {
  add(method: HttpMethod | HttpMethod[] | '*', path: string): RouteKey | RouteKey[];
  addAll(entries: Array<[HttpMethod, string]>): RouteKey[];
  build(): RouterInstance;
}

export interface RouteMethods {
  /** Per-method registered route keys at this node (leaf) */
  byMethod: Map<HttpMethod, RouteKey>;
}

export interface RouterBuilderConstructor<T extends RouterBuilder = RouterBuilder> {
  new (options?: RouterOptions): T;
}
