import {
  dlopen,
  type FFIFunction,
  type Pointer,
  JSCallback,
  FFIType,
} from 'bun:ffi';

import { BunnerFfiError } from './errors';
import { FfiPointer } from './ffi-pointer';
import { isFfiErrorReport, makeFfiError } from './helpers';
import {
  type BaseFfiSymbols,
  type CreateJsCallbackOptions,
} from './interfaces';
import type { AppId } from './types';
import { isPointer, pointerToJson } from './utils';

export abstract class BaseFfi<T extends BaseFfiSymbols> {
  protected symbols: T;
  protected close: () => void;
  protected appId: AppId;

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
    if (appId === 0n) {
      throw new BunnerFfiError(
        'Invalid app id. Please ensure the core initialized correctly.',
      );
    }

    this.appId = appId;
  }

  /**
   * Destroy the Rust core
   * @description Destroy the Rust core
   */
  destroy() {
    if (!this.appId) {
      return;
    }

    this.symbols.destroy(this.appId);
    this.close();

    this.appId = undefined as any;
    this.close = undefined as any;
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
      this.symbols.free(ptr);
    }
  }

  /**
   * Wrap a JS-side callback handler so it runs with adapter pre/post hooks.
   * Returns a function suitable to pass into `new JSCallback(...)`.
   * @param handler The original JS function to wrap
   * @param options The FFIFunction options for the JSCallback
   * @returns A JSCallback instance wrapping the handler
   */
  protected createJsCallback(
    handler: Function,
    options: CreateJsCallbackOptions,
  ) {
    const { callOnce = false, ...ffiOptions } = options;
    const freeArgIndexes: number[] = [];

    options.args?.forEach((arg, index) => {
      if (arg === FFIType.pointer) {
        freeArgIndexes.push(index);
      }
    });

    const wrapperFn = (...args: any[]) => {
      const pointers: FfiPointer[] = [];

      try {
        freeArgIndexes.forEach(index => {
          args[index] = new FfiPointer(
            args[index],
            this.symbols.free.bind(this.symbols),
          );

          pointers.push(args[index]);
        });

        const result = handler.bind(this)(...args);

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
