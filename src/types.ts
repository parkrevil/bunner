import type { BunRequest, RouterTypes } from 'bun';
import { HttpMethod } from './enums';
import type { StaticConfig } from './interfaces';
import { BunnerRequest } from './request';
import { BunnerResponse } from './response';

export type BunRouteValue = RouterTypes.RouteValue<string>;
export type BunRouteHandler = RouterTypes.RouteHandler<string>;
export type BunRouteHandlerObject = RouterTypes.RouteHandlerObject<string>;
export type BunnerServerOptions = Partial<Omit<Bun.ServeOptions, 'hostname' | 'port'>>;
export type RouteHandler = ((req: BunnerRequest, res: BunnerResponse) => any | Promise<any>) | Response;
export type Routes = Map<string, Map<HttpMethod, RouteHandler>>;
export type StaticRoutes = Map<string, StaticConfig>;
export type MiddlewareFn = (req: BunRequest | BunnerRequest, res: BunnerResponse, next: () => any) => any | Promise<any>;
