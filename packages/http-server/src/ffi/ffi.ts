import {
  BaseFfi,
  BunnerError,
  toCString,
  resolveRustLibPath,
  BunnerFfiError,
  FfiPointer,
  toBuffer,
  FFI_APP_ID_TYPE,
  FFI_WORKER_ID_TYPE,
  type WorkerId,
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
  FfiOptions,
  InitResult,
} from './interfaces';
import type { RequestKey } from './types';

export class Ffi extends BaseFfi<FfiSymbols> {
  private readonly workerId: WorkerId;
  private readonly handleRequestCb: JSCallback;
  private readonly pendingHandleRequests: Map<
    RequestKey,
    JSCallbackEntry<HandleRequestResult>
  >;
  private readonly options: FfiOptions;
  private requestKey = 0n;
  private dispatchLoopRunning = false;
  private destroyed = false;

  /**
   * Constructor
   * @description Constructor
   * @returns
   */
  constructor(workerId: WorkerId, options: FfiOptions) {
    const api: Record<keyof FfiSymbols, FFIFunction> = {
      // BaseRustSymbols
      init: { args: [FFIType.pointer], returns: FFIType.pointer },
      destroy: { args: [FFIType.pointer], returns: FFIType.void },
      free: { args: [FFI_APP_ID_TYPE, FFIType.pointer], returns: FFIType.void },

      // HttpServerSymbols
      add_route: {
        args: [
          FFI_APP_ID_TYPE,
          FFI_WORKER_ID_TYPE,
          FFIType.u8,
          FFIType.cstring,
        ],
        returns: FFIType.pointer,
      },
      add_routes: {
        args: [FFI_APP_ID_TYPE, FFI_WORKER_ID_TYPE, FFIType.pointer],
        returns: FFIType.pointer,
      },
      handle_request: {
        args: [
          FFI_APP_ID_TYPE,
          FFI_WORKER_ID_TYPE,
          FFI_REQUEST_KEY_TYPE,
          FFIType.pointer,
          FFIType.function,
        ],
        returns: FFIType.void,
      },
      dispatch_request_callback: {
        args: [FFI_APP_ID_TYPE, FFI_WORKER_ID_TYPE],
        returns: FFIType.void,
      },
      seal_routes: {
        args: [FFI_APP_ID_TYPE],
        returns: FFIType.void,
      },
    };

    super(resolveRustLibPath('bunner_http_server', import.meta.dir), api);

    this.workerId = workerId;
    this.options = options;
    this.pendingHandleRequests = new Map();
    this.handleRequestCb = this.createJsCallback(this.handleRequestCallback, {
      args: [FFI_REQUEST_KEY_TYPE, FFIType.u16, FFIType.pointer],
      returns: FFIType.void,
      threadsafe: true,
    });
  }

  override init() {
    const { appId } = this.ensure<InitResult>(
      this.symbols.init(toBuffer(this.options)),
    );

    super.init(appId);
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
      this.symbols.add_route(
        this.appId,
        this.workerId,
        httpMethod,
        toCString(path),
      ),
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
      this.symbols.add_routes(this.appId, this.workerId, toBuffer(params)),
    );
  }

  /**
   * Handle a request
   * @param params
   * @returns
   */
  async handleRequest(params: HandleRequestParams) {
    const requestKey = ++this.requestKey;
    const promise = new Promise<HandleRequestResult>((resolve, reject) => {
      this.pendingHandleRequests.set(requestKey, { resolve, reject });
    });

    this.symbols.handle_request(
      this.appId,
      this.workerId,
      requestKey,
      toBuffer(params),
      this.handleRequestCb.ptr!,
    );

    // Ensure the dispatch loop runs while there are pending requests
    this.dispatchRequestCallback();

    return promise;
  }

  /**
   * Finalize the routes
   * @description Finalize the routes
   * @returns
   */
  sealRoutes() {
    this.symbols.seal_routes(this.appId);
  }

  /**
   * Start an event-loop-safe infinite recursion to drain callbacks.
   * Idempotent: calling multiple times won't create multiple loops.
   */
  dispatchRequestCallback() {
    if (this.dispatchLoopRunning) {
      return;
    }
    if (this.pendingHandleRequests.size === 0) {
      return;
    }

    this.dispatchLoopRunning = true;

    const tick = () => {
      if (this.destroyed) {
        this.dispatchLoopRunning = false;
        return;
      }

      try {
        this.symbols.dispatch_request_callback(this.appId, this.workerId);
      } catch {}

      if (this.pendingHandleRequests.size > 0) {
        setImmediate(tick);
      } else {
        this.dispatchLoopRunning = false;
      }
    };

    setImmediate(tick);
  }

  /**
   * Gracefully destroy and reject all pending callbacks
   */
  override destroy() {
    console.log('🛑 FFI is destroying...');

    this.destroyed = true;

    const err = new BunnerFfiError('Core destroyed');

    for (const [id, entry] of this.pendingHandleRequests) {
      entry.reject(err);

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
    requestKey = BigInt(requestKey);

    const entry = this.pendingHandleRequests.get(requestKey)!;

    if (entry === undefined) {
      console.error(`No pending handle request for key ${requestKey}`);

      return;
    }

    try {
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
