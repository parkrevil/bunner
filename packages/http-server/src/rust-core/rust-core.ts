import {
  BaseRustCore,
  BunnerError,
  encodeCString,
  pointerToString,
  resolveRustLibPath,
  type JSCallbackEntry,
  RustError,
} from '@bunner/core';
import type { JSCallbackMap } from '@bunner/core/src/rust-core/types';
import { FFIType, JSCallback, type FFIFunction, type Pointer } from 'bun:ffi';

import type { HttpMethod } from '../enums';

import type {
  AddRouteResult,
  HandleRequestOutput,
  HandleRequestParams,
  HandleRequestResult,
  HttpServerSymbols,
} from './interfaces';

export class RustCore extends BaseRustCore<HttpServerSymbols> {
  private handleRequestCb: JSCallback;
  private pendingHandleRequests: JSCallbackMap<HandleRequestResult>;

  /**
   * Constructor
   * @description Constructor
   * @returns
   */
  constructor() {
    super();

    this.pendingHandleRequests = new Map<
      string,
      JSCallbackEntry<HandleRequestResult>
    >();
  }

  override init() {
    const api: Record<keyof HttpServerSymbols, FFIFunction> = {
      // BaseRustSymbols
      free_string: { args: [FFIType.pointer], returns: FFIType.void },
      init: { args: [], returns: FFIType.pointer },
      destroy: { args: [FFIType.pointer], returns: FFIType.void },

      // HttpServerSymbols
      add_route: {
        args: [FFIType.pointer, FFIType.u8, FFIType.cstring],
        returns: FFIType.pointer,
      },
      add_routes: {
        args: [FFIType.pointer, FFIType.cstring],
        returns: FFIType.pointer,
      },
      handle_request: {
        args: [
          FFIType.pointer,
          FFIType.cstring,
          FFIType.cstring,
          FFIType.function,
        ],
        returns: FFIType.void,
      },
      seal_routes: { args: [FFIType.pointer], returns: FFIType.void },
    };

    super.init(resolveRustLibPath('bunner_http_server', import.meta.dir), api);

    this.handleRequestCb = new JSCallback(
      (
        requestIdPtr: Pointer,
        requestIdLength: number,
        routeKey: number,
        resultPtr: Pointer,
        resultLength: number,
      ) => {
        let requestId: string | undefined;
        let entry: JSCallbackEntry<HandleRequestResult> | undefined;

        try {
          if (!requestIdPtr) {
            throw new BunnerError('Request ID pointer is null');
          }

          if (!resultPtr) {
            throw new BunnerError('Result pointer is null');
          }

          requestId = pointerToString(requestIdPtr, requestIdLength);

          this.symbols.free_string(requestIdPtr);

          if (!requestId) {
            throw new BunnerError('Request ID is null');
          }

          entry = this.pendingHandleRequests.get(requestId);

          if (!entry) {
            queueMicrotask(() => {
              throw new BunnerError(
                `No pending promise for requestId=${requestId}`,
              );
            });

            return;
          }

          entry.resolve({
            routeKey,
            ...this.ensure<HandleRequestOutput>(resultPtr, resultLength),
          });
        } catch (e) {
          if (entry?.reject) {
            entry.reject(e);
          } else {
            queueMicrotask(() => {
              throw e;
            });
          }
        } finally {
          if (requestIdPtr) {
            this.symbols.free_string(requestIdPtr);
          }

          if (resultPtr) {
            this.symbols.free_string(resultPtr);
          }

          if (requestId) {
            this.pendingHandleRequests.delete(requestId);
          }
        }
      },
      {
        args: [
          FFIType.pointer,
          FFIType.u32,
          FFIType.u16,
          FFIType.pointer,
          FFIType.u32,
        ],
        returns: FFIType.void,
        threadsafe: true,
      },
    );
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
        this.handle,
        httpMethod as unknown as FFIType.u8,
        encodeCString(path),
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
      this.symbols.add_routes(this.handle, encodeCString(params)),
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
    const requestId = Bun.randomUUIDv7();
    const promise = new Promise<HandleRequestResult>((resolve, reject) => {
      this.pendingHandleRequests.set(requestId, { resolve, reject });
    });

    this.symbols.handle_request(
      this.handle,
      encodeCString(requestId),
      encodeCString(params),
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
    return this.symbols.seal_routes(this.handle);
  }

  /**
   * Gracefully destroy and reject all pending callbacks
   */
  override destroy() {
    const err = new RustError('Core destroyed');

    for (const [id, entry] of this.pendingHandleRequests) {
      entry.reject?.(err);

      this.pendingHandleRequests.delete(id);
    }

    super.destroy();
  }
}
