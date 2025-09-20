import type {
  AppId,
  BaseFfiSymbols,
  BaseInitResult,
  LogLevel,
  WorkerId,
} from '@bunner/core';
import type { Pointer } from 'bun:ffi';
import type { StatusCodes } from 'http-status-codes';

import type { HttpMethod } from '../enums';

import type { RequestKey } from './types';

export interface FfiSymbols extends BaseFfiSymbols {
  add_route: (
    appId: AppId,
    workerId: WorkerId,
    method: HttpMethod,
    path: Uint8Array,
  ) => Pointer | null;
  add_routes: (
    appId: AppId,
    workerId: WorkerId,
    routes: Uint8Array,
  ) => Pointer | null;
  handle_request: (
    appId: AppId,
    requestKey: RequestKey,
    payload: Uint8Array,
    callback: Pointer,
  ) => void;
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
  name: string;
  logLevel: LogLevel;
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
  body: string | null;
}

/**
 * Handle Request Output
 * @description The output interface for Handle Request
 */
export interface HandleRequestOutput {
  request: FfiBunnerRequest;
  response: FfiBunnerResponse;
}

/**
 * Handle Request Result
 * @description The result interface for Handle Request
 */
export interface HandleRequestResult extends HandleRequestOutput {
  routeKey: number;
}

/**
 * Rust Bunner Request
 * @description The request interface for Rust Bunner
 */
export interface FfiBunnerRequest {
  requestId: string;
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
export interface FfiBunnerResponse {
  httpStatus: StatusCodes;
  headers: Record<string, any>;
  body: string | Record<string, any>;
}
