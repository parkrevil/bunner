import {
  encodeCString,
  resolveRustLibPath,
  stringPointerToJson,
} from '@bunner/core';
import { dlopen, FFIType, type Pointer } from 'bun:ffi';

import type { HttpMethodValue } from '../types';

import { toError } from './helpers';
import type {
  AddRouteResult,
  HandleRequestResult,
  HttpServerSymbols,
} from './interfaces';

export class RustCore {
  private symbols: HttpServerSymbols;
  private close: () => void;
  private handle: Pointer;

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
            args: [FFIType.pointer, FFIType.u8, FFIType.cstring],
            returns: FFIType.pointer,
          },
          router_seal: { args: [FFIType.pointer], returns: FFIType.void },
          free_string: { args: [FFIType.pointer], returns: FFIType.void },
        },
      );

      if (!lib.symbols) {
        throw new Error('Failed to initialize RustCore');
      }

      this.symbols = lib.symbols;
      this.close = () => lib.close();
    } catch (e: any) {
      throw new Error(`Failed to initialize RustCore: ${e.message}`);
    }
  }

  init() {
    const handle = this.symbols.init();

    if (handle === null) {
      throw new Error('Failed to initialize Rust core');
    }

    this.handle = handle;
  }

  destroy(): void {
    if (!this.handle) {
      return;
    }

    this.symbols.destroy(this.handle);
    this.close();
  }

  /**
   * Handle a request
   * @param method
   * @param path
   * @returns
   */
  handleRequest(method: HttpMethodValue, path: string) {
    const resultPtr = this.symbols.handle_request(
      this.handle,
      method as FFIType.u8,
      encodeCString(path),
    );

    if (resultPtr === null) {
      throw toError();
    }

    const result = stringPointerToJson<HandleRequestResult>(resultPtr);

    this.symbols.free_string(resultPtr);

    const error = toError(result.error);
    if (error) {
      throw error;
    }

    return result.key;
  }

  /**
   * Add a route to the router
   * @param method
   * @param path
   * @returns
   */
  addRoute(method: HttpMethodValue, path: string) {
    const resultPtr = this.symbols.router_add(
      this.handle,
      method as FFIType.u8,
      encodeCString(path),
    );

    if (resultPtr === null) {
      throw toError();
    }

    const result = stringPointerToJson<AddRouteResult>(resultPtr);

    this.symbols.free_string(resultPtr);

    const error = toError(result.error);
    if (error) {
      throw error;
    }

    return result.key;
  }

  /**
   * Seal the router
   * @returns
   */
  build() {
    return this.symbols.router_seal(this.handle);
  }
}
