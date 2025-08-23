import type { BunRouteHandler, HttpMethodType } from '../types';

export interface BunRoute {
  [httpMethod: HttpMethodType]: BunRouteHandler;
}
