import type { Server } from 'bun';
import type { FFIType, Pointer } from 'bun:ffi';
import type { HttpMethodValue } from '../types';

export interface HttpServerSymbols {
  init: () => Pointer | null;
  destroy: (handle: Pointer) => void;
  handle_request: (
    handle: Pointer,
    requestJson: Uint8Array,
  ) => Pointer | null;
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
 */
export interface AddRouteResult {
  key: number;
  error: number;
}

/**
 * Find Route Result
 */
export interface HandleRequestParams {
  httpMethod: HttpMethodValue;
  url: string;
  headers: Record<string, any>;
  body: string | null;
}

export interface HandleRequestResult {
  key: number;
  params: Record<string, string> | null;
  error: number;
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
