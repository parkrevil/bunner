import type { Server } from 'bun';
import type { FFIType, Pointer } from 'bun:ffi';

import type { HttpMethodValue } from '../types';

export interface HttpServerSymbols {
  init: () => Pointer | null;
  destroy: (handle: Pointer) => void;
  handle_request: (handle: Pointer, requestJson: Uint8Array) => Pointer | null;
  router_add: (
    handle: Pointer,
    method: FFIType.u8,
    path: Uint8Array,
  ) => Pointer | null;
  router_seal: (handle: Pointer) => void;
  free_string: (ptr: Pointer) => void;
}

/**
 * Add Route Result
 * @description The result interface for Add Route
 */
export interface AddRoutResult {
  key: number;
}

/**
 * Add Routes Result
 * @description The result interface for Add Routes
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
  setted: {
    httpStatus: number;
    headers: Record<string, any> | null;
    body: string | null;
    responseImmediately: boolean;
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
