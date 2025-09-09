import type { BaseRustSymbols } from '@bunner/core';
import type { Server } from 'bun';
import type { FFIType, Pointer } from 'bun:ffi';

import type { HttpMethodValue } from '../types';

export interface HttpServerSymbols extends BaseRustSymbols {
  handle_request: (handle: Pointer, requestJson: Uint8Array) => Pointer | null;
  add_route: (
    handle: Pointer,
    method: FFIType.u8,
    path: Uint8Array,
  ) => Pointer | null;
  add_routes: (handle: Pointer, routes: Uint8Array) => Pointer | null;
  router_seal: (handle: Pointer) => void;
}

/**
 * Add Routes Params
 * @description The params interface for Add Routes
 */
export interface AddRouteParams {
  httpMethod: HttpMethodValue;
  path: string;
}

/**
 * Add Route Result
 * @description The result interface for Add Route
 */
export interface AddRouteResult {
  key: number;
}

/**
 * Add Routes Result
 * @description The result value when multiple routes are added at once (bulk insert)
 */
export interface AddRoutesResult {
  keys: number[];
}

/**
 * Find Route Result
 * @description The result interface for Find Route
 */
export interface HandleRequestParams {
  httpMethod: HttpMethodValue;
  url: string;
  headers: Record<string, any>;
  body: string | null;
}

/**
 * Handle Request Result
 * @description The result interface for Handle Request
 */
export interface HandleRequestResult {
  routeKey: number;
  params: Record<string, any> | null;
  queryParams: Record<string, any> | null;
  body: Record<string, any> | null;
  response: {
    httpStatus: number;
    headers: Record<string, any> | null;
    body: any;
  } | null;
}

/**
 * Bunner Request Constructor Params
 */
export interface BunnerRequestConstructorParams {
  request: Request;
  server: Server;
  params: Record<string, any>;
  queryParams: Record<string, any>;
}
