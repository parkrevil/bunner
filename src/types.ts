import { BunRequest, RouterTypes } from 'bun';
import { HttpMethod } from './enums';
import { BunnerResponse } from './response';

export type BunRouteValue = RouterTypes.RouteValue<string>;
export type BunRouteHandler = RouterTypes.RouteHandler<string>;
export type BunRouteHandlerObject = RouterTypes.RouteHandlerObject<string>;
export type RouteHandler = (req: BunRequest, res: BunnerResponse) => any | Promise<any>;
export type Routes = Map<string, Map<HttpMethod, RouteHandler>>;
