import type { BaseFfiSymbols } from '@bunner/core';
import type { FFIType, Pointer } from 'bun:ffi';
import type { StatusCodes } from 'http-status-codes';

import type { HttpMethod } from '../enums';

export interface HttpServerSymbols extends BaseFfiSymbols {
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
  seal_routes: (handle: Pointer) => void;
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
  httpMethod: HttpMethod;
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

/**
 * Rust Bunner Request
 * @description The request interface for Rust Bunner
 */
export interface RustBunnerRequest {
  httpMethod: HttpMethod;
  path: string;
  cookies: Record<string, any>;
  contentType: string | null;
  contentLength: number | null;
  charset: string | null;
  params: Record<string, any> | null;
  queryParams: Record<string, any> | null;
  body: Record<string, any> | null;
}

/**
 * Rust Bunner Response
 * @description The response interface for Rust Bunner
 */
export interface RustBunnerResponse {
  httpStatus: StatusCodes;
  headers: Record<string, any>;
  body: string | Record<string, any>;
}
