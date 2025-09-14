import { dlopen, type FFIFunction, type Pointer } from 'bun:ffi';

import { RustError } from './errors';
import { type BaseRustSymbols, type FfiError } from './interfaces';
import { pointerToJson } from './utils';

export abstract class BaseRustCore<T extends BaseRustSymbols> {
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
      throw new RustError('Failed to load Rust core');
    }

    this.symbols = lib.symbols as T;
    this.close = () => lib.close();

    const handle = this.symbols.init();

    if (!handle) {
      throw new RustError('Failed to initialize Rust core');
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
    try {
      if (!ptr) {
        throw new RustError('Rust result is null');
      }

      const result = pointerToJson<T>(ptr, length);

      if (this.isError(result)) {
        throw this.makeError(result);
      }

      return result;
    } catch (error) {
      if (error instanceof RustError) {
        throw error;
      }

      throw new RustError('Failed to parse Rust result', error);
    } finally {
      if (ptr) {
        this.symbols.free_string(ptr);
      }
    }
  }

  /**
   * Check if a value is an error
   * @description Check if a value is an error
   * @param error
   * @returns
   */
  protected isError(error: any): error is FfiError {
    return Object.hasOwn(error, 'code') && Object.hasOwn(error, 'error');
  }

  /**
   * Make an error
   * @description Make an error
   * @param error
   * @returns
   */
  protected makeError(error: FfiError) {
    if (!error.code) {
      return new RustError('UnknownError');
    }

    return new RustError(error.description, error);
  }
}
