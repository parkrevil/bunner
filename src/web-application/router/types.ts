import type { RouterTypes } from 'bun';
import type { BunRoute } from './interfaces';

export type BunRoutes = Record<string, BunRoute>;
export type BunRouteHandler = RouterTypes.RouteHandler<string>;
