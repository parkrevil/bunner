import { ROUTER_SNAPSHOT_METADATA } from '@bunner/core';

import type { HttpMethod } from '../enums';
import type { RouteKey } from '../types';

import type { ImmutableRouterLayout } from './immutable-layout';
import type { ParamOrderSnapshot, RouterOptions, RouteMatch, RouterSnapshotMetadata } from './types';

export interface RouterInstance {
  match(method: HttpMethod, path: string): RouteMatch | null;
  getMetadata(): RouterSnapshotMetadata;
  getLayoutSnapshot(): ImmutableRouterLayout | undefined;
  getAllowedMethods(path: string): HttpMethod[];
  exportParamOrderSnapshot(): ParamOrderSnapshot | null;
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
