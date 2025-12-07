import { ROUTER_SNAPSHOT_METADATA } from '@bunner/core';

import type { HttpMethod } from '../enums';
import type { RouteKey } from '../types';

import type { ImmutableRouterLayout } from './layout/immutable-router-layout';
import type { ParamOrderSnapshot, RouterCacheSnapshot, RouterOptions, RouteMatch, RouterSnapshotMetadata } from './types';

export interface RouterInstance {
  match(method: HttpMethod, path: string): RouteMatch | null;
  getMetadata(): RouterSnapshotMetadata;
  getLayoutSnapshot(): ImmutableRouterLayout | undefined;
  exportParamOrderSnapshot(): ParamOrderSnapshot | null;
  exportCacheSnapshot(): RouterCacheSnapshot | null;
  hydrateCacheSnapshot(snapshot: RouterCacheSnapshot | null): void;
  [ROUTER_SNAPSHOT_METADATA]?: RouterSnapshotMetadata;
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
