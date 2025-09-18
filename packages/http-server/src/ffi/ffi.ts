import {
  BaseFfi,
  BunnerError,
  toCString,
  resolveRustLibPath,
  BunnerFfiError,
  FfiPointer,
  toBuffer,
  FFI_APP_ID_TYPE,
} from '@bunner/core';
import { FFIType, JSCallback, type FFIFunction } from 'bun:ffi';

import type { HttpMethod } from '../enums';

import { FFI_REQUEST_KEY_TYPE } from './constants';
import type {
  AddRouteResult,
  HandleRequestOutput,
  HandleRequestParams,
  HandleRequestResult,
  FfiSymbols,
  JSCallbackEntry,
} from './interfaces';
import type { RequestKey } from './types';

export class Ffi extends BaseFfi<FfiSymbols> {
  private handleRequestCb: JSCallback;
  private pendingHandleRequests: Map<
    RequestKey,
    JSCallbackEntry<HandleRequestResult>
  >;
  private requestKey = 0n;

  /**
   * Constructor
   * @description Constructor
   * @returns
   */
  constructor() {
    super();

    this.pendingHandleRequests = new Map();
  }

  override init() {
    const api: Record<keyof FfiSymbols, FFIFunction> = {
      // BaseRustSymbols
      free: { args: [FFI_APP_ID_TYPE], returns: FFIType.void },
      construct: { args: [], returns: FFIType.u8 },
      destroy: { args: [FFIType.pointer], returns: FFIType.void },

      // HttpServerSymbols
      add_route: {
        args: [FFI_APP_ID_TYPE, FFIType.u8, FFIType.cstring],
        returns: FFIType.pointer,
      },
      add_routes: {
        args: [FFI_APP_ID_TYPE, FFIType.pointer],
        returns: FFIType.pointer,
      },
      handle_request: {
        args: [
          FFI_APP_ID_TYPE,
          FFI_REQUEST_KEY_TYPE,
          FFIType.pointer,
          FFIType.function,
        ],
        returns: FFIType.void,
      },
      seal_routes: {
        args: [FFI_APP_ID_TYPE],
        returns: FFIType.void,
      },
    };

    super.init(resolveRustLibPath('bunner_http_server', import.meta.dir), api);

    this.handleRequestCb = this.createJsCallback(this.handleRequestCallback, {
      args: [FFI_REQUEST_KEY_TYPE, FFIType.u16, FFIType.pointer],
      returns: FFIType.void,
      threadsafe: true,
    });
  }

  /**
   * Add a route to the router
   * @description Add a route to the router
   * @param method
   * @param path
   * @returns
   */
  addRoute(httpMethod: HttpMethod, path: string) {
    return this.ensure<AddRouteResult>(
      this.symbols.add_route(this.appId, httpMethod, toCString(path)),
    );
  }

  /**
   * Add multiple routes to the router
   * @description Add multiple routes to the router
   * @param params
   * @returns
   */
  addRoutes(params: [HttpMethod, string][]) {
    return this.ensure<number[]>(
      this.symbols.add_routes(this.appId, toBuffer(params)),
    );
  }

  /**
   * Handle a request
   * @param params
   * @returns
   */
  async handleRequest(
    params: HandleRequestParams,
  ): Promise<HandleRequestResult> {
    const requestKey = ++this.requestKey;
    const promise = new Promise<HandleRequestResult>((resolve, reject) => {
      this.pendingHandleRequests.set(requestKey, { resolve, reject });
    });

    this.symbols.handle_request(
      this.appId,
      requestKey,
      toBuffer(params),
      this.handleRequestCb.ptr!,
    );

    return promise;
  }

  /**
   * Finalize the routes
   * @description Finalize the routes
   * @returns
   */
  buildRoutes() {
    this.symbols.seal_routes(this.appId);
  }

  /**
   * Gracefully destroy and reject all pending callbacks
   */
  override destroy() {
    const err = new BunnerFfiError('Core destroyed');

    for (const [id, entry] of this.pendingHandleRequests) {
      entry.reject?.(err);

      this.pendingHandleRequests.delete(id);
    }

    super.destroy();
  }

  /**
   * Handle request callback
   * @param requestIdPtr - The request ID pointer
   * @param requestIdLength - The request ID length
   * @param routeKey - The route key
   * @param resultPtr - The result pointer
   * @param resultLength - The result length
   */
  private handleRequestCallback(
    requestKey: RequestKey,
    routeKey: number,
    resultPtr: FfiPointer,
  ) {
    const entry = this.pendingHandleRequests.get(requestKey)!;

    if (entry === undefined) {
      console.error(`No pending handle request for key ${requestKey}`);

      return;
    }

    try {
      if (!resultPtr.isValid()) {
        throw new BunnerError('Result pointer is null');
      }

      const result = resultPtr.toResult<HandleRequestOutput>();

      if (!result) {
        throw new BunnerError('Result is null');
      }

      entry.resolve({ routeKey, ...result });
    } catch (e) {
      entry.reject(e);
    } finally {
      this.pendingHandleRequests.delete(requestKey);
    }
  }
}
