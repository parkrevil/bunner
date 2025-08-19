import { RouterTypes } from 'bun';
import { HttpMethod } from './enums';
import { BunnerRequest } from './request';
import { BunnerResponse } from './response';

export type BunRouteValue = RouterTypes.RouteValue<string>;
export type BunRouteHandler = RouterTypes.RouteHandler<string>;
export type BunRouteHandlerObject = RouterTypes.RouteHandlerObject<string>;

export type BunnerServerOptions = Partial<Omit<Bun.ServeOptions, 'hostname' | 'port'>>;
export type RouteHandler = (req: BunnerRequest, res: BunnerResponse) => any | Promise<any>;
export type Routes = Map<string, Map<HttpMethod, RouteHandler>>;
export type MiddlewareFn = (req: BunnerRequest, res: BunnerResponse, next: () => any) => any | Promise<any>;
