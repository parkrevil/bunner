import { dlopen, type FFIFunction, type Pointer, JSCallback } from 'bun:ffi';

import { MetadataKey } from './enums';
import { BunnerFfiError } from './errors';
import { FfiPointer } from './ffi-pointer';
import { isFfiErrorReport, makeFfiError } from './helpers';
import { type BaseFfiSymbols } from './interfaces';
import type { FfiFunctionMetadata } from './types';
import { isPointer, pointerToJson } from './utils';

export abstract class BaseFfiCore<T extends BaseFfiSymbols> {
  protected symbols: T;
  protected close: () => void;
  protected handle: Pointer;

  /**
   * Initialize the Rust core
   * @description Initialize the Rust core
   */
  init(libPath: string, api: Record<keyof T, FFIFunction>) {
    const lib = dlopen(libPath, api);

    if (!lib.symbols) {
      throw new BunnerFfiError('Failed to load Rust core');
    }

    this.symbols = lib.symbols as T;
    this.close = () => lib.close();

    const handle = this.symbols.init();

    if (!handle) {
      throw new BunnerFfiError('Failed to initialize Rust core');
    }

    this.handle = handle;
  }

  /**
   * Destroy the Rust core
   * @description Destroy the Rust core
   */
  destroy() {
    if (!this.handle) {
      return;
    }

    this.symbols.destroy(this.handle);
    this.close();

    this.handle = undefined as any;
    this.close = undefined as any;
  }

  /**
   * Ensure a value is not null
   * @description Ensure a value is not null
   * @param ptr
   * @param length
   * @returns
   */
  protected ensure<T>(ptr: Pointer | null, length?: number): T {
    if (!isPointer(ptr)) {
      throw new BunnerFfiError('Invalid pointer');
    }

    try {
      const result = pointerToJson<T>(ptr, length);

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
      this.symbols.free_string(ptr);
    }
  }

  /**
   * Wrap a JS-side callback handler so it runs with adapter pre/post hooks.
   * Returns a function suitable to pass into `new JSCallback(...)`.
   * @param handler The original JS function to wrap
   * @param options The FFIFunction options for the JSCallback
   * @returns A JSCallback instance wrapping the handler
   */
  protected createJsCallback(handler: Function, options: FFIFunction) {
    const thisProto = Object.getPrototypeOf(this);
    const methodName = Object.getOwnPropertyNames(thisProto).filter(
      r => thisProto[r] === handler,
    )?.[0];

    if (!methodName) {
      throw new BunnerFfiError(
        'Failed to find method name for JSCallback handler',
      );
    }

    const callbackMetadata: FfiFunctionMetadata = Reflect.getOwnMetadata(
      MetadataKey.FfiCallback,
      thisProto,
      methodName,
    );

    if (!callbackMetadata) {
      throw new BunnerFfiError('Failed to find FFI callback metadata');
    }

    const wrapperFn = (...ffiArgs: any[]) => {
      const pointers: FfiPointer<any>[] = [];

      try {
        const clonedArgs = ffiArgs.slice();
        const args: any[] = [];

        let i = -1;

        while (clonedArgs.length) {
          ++i;

          const arg = clonedArgs.shift();
          const type = callbackMetadata.get(i);

          if (type === undefined) {
            args.push(arg);

            continue;
          }

          const length = clonedArgs.shift();

          if (typeof length !== 'number') {
            throw new BunnerFfiError(
              `Expected length argument at index ${i + 1} for FFI callback`,
            );
          }

          ++i;

          const pointer = new FfiPointer({
            type,
            pointer: arg,
            length: Number(length),
            freeFn: this.symbols.free_string.bind(this.symbols),
          });

          args.push(pointer, length);
          pointers.push(pointer);
        }

        return handler.bind(this)(...args);
      } finally {
        for (const pointer of pointers) {
          pointer.free();
        }
      }
    };

    return new JSCallback(wrapperFn, options as any);
  }
}
