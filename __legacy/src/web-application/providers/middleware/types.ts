import type { HttpMethodValue } from '../../types';
import type { Middleware, MiddlewarePhase } from './interfaces';

export type MiddlewareGroup = Middleware | Middleware[];

export type RoutePatternTester = (method: HttpMethodValue, path: string) => boolean;

export type CompiledRouteEntry = {
  test: RoutePatternTester;
  specificity: number;
  middleware: MiddlewareGroup;
};

export type PhaseMiddlewareMap = Record<MiddlewarePhase, MiddlewareGroup[]>;
