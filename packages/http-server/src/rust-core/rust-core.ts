import { BaseRustCore, encodeCString, resolveRustLibPath } from '@bunner/core';
import { FFIType } from 'bun:ffi';

import type { HttpMethodValue } from '../types';

import { HttpServerErrorCodes } from './constants';
import type {
  AddRouteResult,
  HandleRequestParams,
  HandleRequestResult,
  HttpServerSymbols,
} from './interfaces';

export class RustCore extends BaseRustCore<
  HttpServerSymbols,
  typeof HttpServerErrorCodes
> {
  /**
   * Constructor
   * @description Constructor
   * @returns
   */
  constructor() {
    super(HttpServerErrorCodes);
  }

  override init() {
    const api: Record<keyof HttpServerSymbols, any> = {
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
        args: [FFIType.pointer, FFIType.cstring],
        returns: FFIType.pointer,
      },
      router_seal: { args: [FFIType.pointer], returns: FFIType.void },
    };

    super.init(resolveRustLibPath('bunner_http_server', import.meta.dir), api);
  }

  /**
   * Add a route to the router
   * @description Add a route to the router
   * @param method
   * @param path
   * @returns
   */
  addRoute(httpMethod: HttpMethodValue, path: string) {
    return this.ensure<AddRouteResult>(
      this.symbols.add_route(
        this.handle,
        httpMethod as FFIType.u8,
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
  addRoutes(params: [HttpMethodValue, string][]) {
    return this.ensure<number[]>(
      this.symbols.add_routes(this.handle, encodeCString(params)),
    );
  }

  /**
   * Handle a request
   * @param params
   * @returns
   */
  handleRequest(params: HandleRequestParams) {
    return this.ensure<HandleRequestResult>(
      this.symbols.handle_request(
        this.handle,
        encodeCString(JSON.stringify(params)),
      ),
    );
  }

  /**
   * Finalize the routes
   * @description Finalize the routes
   * @returns
   */
  finalizeRoutes() {
    return this.symbols.router_seal(this.handle);
  }
}
