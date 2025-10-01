import { dlopen, type FFIFunction, type Pointer, JSCallback, FFIType } from 'bun:ffi';

import type { SyncFunction } from '../common';

import { BunnerFfiError } from './errors';
import { FfiPointer } from './ffi-pointer';
import { isFfiErrorReport, makeFfiError } from './helpers';
import { type BaseFfiSymbols, type CreateJsCallbackOptions } from './interfaces';
import type { AppId } from './types';
import { isPointer, pointerToJson } from './utils';

export abstract class BaseFfi<T extends BaseFfiSymbols> {
  protected appId: AppId;
  protected symbols: T;
  protected close: () => void;

  constructor(libPath: string, api: Record<keyof T, FFIFunction>) {
    const lib = dlopen(libPath, api);

    if (!lib.symbols) {
      throw new BunnerFfiError('Failed to load Rust core');
    }

    this.symbols = lib.symbols as T;
    this.close = () => lib.close();
  }

  /**
   * Initialize the Rust core
   * @description Initialize the Rust core
   */
  init(appId: AppId) {
    if (appId === 0) {
      throw new BunnerFfiError('Invalid app id. Please ensure the core initialized correctly.');
    }

    this.appId = appId;
  }

  /**
   * Destroy the Rust core
   * @description Destroy the Rust core
   */
  destroy() {
    this.symbols.destroy(this.appId);

    this.close();
  }

  /**
   * Ensure a value is not null
   * @description Ensure a value is not null
   * @param ptr
   * @param length
   * @returns
   */
  protected ensure<T>(ptr: Pointer | null): T {
    if (!isPointer(ptr)) {
      throw new BunnerFfiError('Invalid pointer');
    }

    try {
      const result = pointerToJson<T>(ptr);

      if (isFfiErrorReport(result)) {
        throw makeFfiError(result);
      }

      return result;
    } catch (e) {
      if (e instanceof BunnerFfiError) {
        throw e;
      }

      throw new BunnerFfiError('Failed to parse FFI result', e);
    } finally {
      this.symbols.free(this.appId, ptr);
    }
  }

  /**
   * Wrap a JS-side callback handler so it runs with adapter pre/post hooks.
   * Returns a function suitable to pass into `new JSCallback(...)`.
   * @param handler The original JS function to wrap
   * @param options The FFIFunction options for the JSCallback
   * @returns A JSCallback instance wrapping the handler
   */
  protected createJsCallback<F extends (...args: any[]) => unknown>(handler: SyncFunction<F>, options: CreateJsCallbackOptions) {
    const { callOnce = false, ...ffiOptions } = options;
    const freeArgIndexes: number[] = [];
    const pointerFn = (ptr: Pointer) => this.symbols.free(this.appId, ptr);

    options.args?.forEach((arg, index) => {
      if (arg === FFIType.pointer) {
        freeArgIndexes.push(index);
      }
    });

    const wrapperFn = (...args: any[]) => {
      const pointers: FfiPointer[] = [];

      try {
        freeArgIndexes.forEach(index => {
          args[index] = new FfiPointer(args[index], pointerFn);

          pointers.push(args[index]);
        });

        const fn = (handler as (...args: any[]) => unknown).bind(this);
        const result = fn(...args);

        // Runtime guard: disallow thenable results (async behavior)
        if (result && typeof (result as any).then === 'function') {
          throw new BunnerFfiError('Async handlers are not supported in JSCallback. Handler returned a Promise.');
        }

        return result;
      } finally {
        for (const pointer of pointers) {
          pointer.free();
        }

        if (callOnce && jsCallback) {
          jsCallback.close();
        }
      }
    };

    const jsCallback = new JSCallback(wrapperFn, ffiOptions);

    return jsCallback;
  }
}
