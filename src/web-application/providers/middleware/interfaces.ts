import type { BunnerRequest } from '../../request';
import type { BunnerResponse } from '../../response';
import type { MiddlewareGroup } from './types.js';

export interface MiddlewareContext {
  req: BunnerRequest;
  res: BunnerResponse;
  path: string;
}

export type MiddlewarePhase = 'onRequest' | 'beforeHandler' | 'afterHandler' | 'afterResponse';

export interface Middleware {
  run: (req: BunnerRequest, res: BunnerResponse) => BunnerResponse | void | Promise<BunnerResponse | void>;
}

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
