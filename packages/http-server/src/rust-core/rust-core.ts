import { BaseRustCore, encodeCString, resolveRustLibPath } from '@bunner/core';
import { dlopen, FFIType } from 'bun:ffi';

import type { HttpMethodValue } from '../types';

import { HttpServerErrorCodes } from './constants';
import type {
  AddRoutesResult,
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
    try {
      const lib = dlopen(
        resolveRustLibPath('bunner_http_server', import.meta.dir),
        {
          // HTTP Server
          init: { args: [], returns: FFIType.pointer },
          destroy: { args: [FFIType.pointer], returns: FFIType.void },

          // Router
          router_add: {
            args: [FFIType.pointer, FFIType.u8, FFIType.cstring],
            returns: FFIType.pointer,
          },
          handle_request: {
            args: [FFIType.u64, FFIType.cstring],
            returns: FFIType.ptr,
          },
          router_seal: { args: [FFIType.pointer], returns: FFIType.void },
          free_string: { args: [FFIType.pointer], returns: FFIType.void },
        },
      );

      super(lib.symbols, () => lib.close(), HttpServerErrorCodes);
    } catch (e: any) {
      throw new Error(`Failed to initialize RustCore: ${e.message}`);
    }
  }

  /**
   * Add a route to the router
   * @description Add a route to the router
   * @param method
   * @param path
   * @returns
   */
  addRoute(method: HttpMethodValue, path: string) {
    return this.ensure<AddRoutesResult>(
      this.symbols.router_add(
        this.handle,
        method as FFIType.u8,
        encodeCString(path),
      ),
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
