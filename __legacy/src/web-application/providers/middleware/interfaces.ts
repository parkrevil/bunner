import type { BunnerRequest } from '../../request.js';
import type { BunnerResponse } from '../../response.js';
import type { MiddlewareGroup } from './types.js';

export interface MiddlewareContext {
  req: BunnerRequest;
  res: BunnerResponse;
  path: string;
  app: AppRef;
}

export type MiddlewarePhase = 'onRequest' | 'beforeHandler' | 'afterHandler' | 'afterResponse';

export interface AppRef {
  get<T>(id: any): T;
}

export type Middleware = (
  req: BunnerRequest,
  res: BunnerResponse,
  app: AppRef
) => BunnerResponse | void | Promise<BunnerResponse | void>;

export interface GlobalMiddlewareOptions extends Partial<GlobalMiddlewareRegistry> { }

export interface RouteMiddlewareOptions {
  beforeHandler?: Record<string, MiddlewareGroup>;
  afterHandler?: Record<string, MiddlewareGroup>;
}

export interface GlobalMiddlewareRegistry {
  onRequest: MiddlewareGroup[];
  beforeHandler: MiddlewareGroup[];
  afterHandler: MiddlewareGroup[];
  afterResponse: MiddlewareGroup[];
}

export interface RouteMiddlewareRegistry {
  beforeHandler: Array<{ pattern: string; middleware: MiddlewareGroup }>;
  afterHandler: Array<{ pattern: string; middleware: MiddlewareGroup }>;
}

export interface PrecomputedRouteMiddlewares {
  beforeHandler: MiddlewareGroup[];
  afterHandler: MiddlewareGroup[];
}
