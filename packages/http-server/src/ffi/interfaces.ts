import type { AppId, BaseFfiSymbols, BaseInitResult, LogLevel, WorkerId } from '@bunner/core';
import type { Pointer } from 'bun:ffi';
import type { StatusCodes } from 'http-status-codes';

import type { HttpMethod } from '../enums';
import type { RouteKey } from '../types';

import type { RequestKey } from './types';

export interface FfiSymbols extends BaseFfiSymbols {
  add_route: (appId: AppId, workerId: WorkerId, method: HttpMethod, path: Uint8Array) => Pointer | null;
  add_routes: (appId: AppId, workerId: WorkerId, routes: Uint8Array) => Pointer | null;
  handle_request: (appId: AppId, workerId: WorkerId, requestKey: RequestKey, payload: Uint8Array, callback: Pointer) => void;
  dispatch_request_callback: (appId: AppId, workerId: WorkerId) => void;
  seal_routes: (appId: AppId) => void;
}

/**
 * JS Callback Entry
 * @description The entry for a JS callback
 * @param T - The type for the result
 */
export interface JSCallbackEntry<T> {
  resolve: (v: T) => void;
  reject: (e: unknown) => void;
}

/**
 * FFI Options
 * @description Options for the FFI
 */
export interface FfiOptions {
  appName: string;
  logLevel: LogLevel;
  workers: number;
  queueCapacity: number;
}

/**
 * Construct Result
 * @description The result interface for Construct
 */
export interface InitResult extends BaseInitResult {}

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
  body: string | undefined;
  request: {
    ip: string | undefined;
    ips: string[] | undefined;
    isTrustedProxy: boolean;
  };
}

/**
 * Handle Request Result
 * @description The result interface for Handle Request
 */
export interface HandleRequestResult {
  routeKey: RouteKey;
  request: FfiBunnerRequest;
  response: FfiBunnerResponse;
}

/**
 * Rust Bunner Request
 * @description The request interface for Rust Bunner
 */
export interface FfiBunnerRequest {
  requestId: string;
  httpMethod: HttpMethod;
  url: string;
  path: string;
  headers: Record<string, string>;
  protocol: string | null;
  host: string | null;
  hostname: string | null;
  port: number | null;
  queryString: string | null;
  ip: string | null;
  ips: string[];
  isTrustedProxy: boolean;
  subdomains: string[];
  cookies: Record<string, any>;
  contentType: string | null;
  contentLength: number | null;
  charset: string | null;
  params: Record<string, any>;
  queryParams: Record<string, any>;
  body: string | Record<string, any> | null;
}

/**
 * Rust Bunner Response
 * @description The response interface for Rust Bunner
 */
export interface FfiBunnerResponse {
  status: StatusCodes;
  headers: Record<string, any>;
  body: string | Record<string, any> | null;
}
