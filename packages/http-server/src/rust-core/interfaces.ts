import type { BaseRustSymbols } from '@bunner/core';
import type { FFIType, Pointer } from 'bun:ffi';

import type { HttpMethodValue, HttpStatusCode } from '../types';

export interface HttpServerSymbols extends BaseRustSymbols {
  add_route: (
    handle: Pointer,
    method: FFIType.u8,
    path: Uint8Array,
  ) => Pointer | null;
  add_routes: (handle: Pointer, routes: Uint8Array) => Pointer | null;
  handle_request: (
    handle: Pointer,
    requestId: Uint8Array,
    payload: Uint8Array,
    callback: Pointer,
  ) => void;
  router_seal: (handle: Pointer) => void;
}

/**
 * Add Route Result
 * @description The result interface for Add Route
 */
export interface AddRouteResult {
  key: number;
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
 * Handle Request Output
 * @description The output interface for Handle Request
 */
export interface HandleRequestOutput {
  request: RustBunnerRequest;
  response: RustBunnerResponse;
}

/**
 * Handle Request Result
 * @description The result interface for Handle Request
 */
export interface HandleRequestResult {
  routeKey: number;
  request: RustBunnerRequest;
  response: RustBunnerResponse;
}

export interface RustBunnerRequest {
  url: string;
  httpMethod: HttpMethodValue;
  path: string;
  headers: Record<string, any>;
  cookies: Record<string, any>;
  contentType: string;
  charset: string;
  params: Record<string, any> | null;
  queryParams: Record<string, any> | null;
  body: Record<string, any>;
}

export interface RustBunnerResponse {
  httpStatus: HttpStatusCode;
  headers: Record<string, any>;
  body: string | Record<string, any>;
}
