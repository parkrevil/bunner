import { dlopen, type FFIFunction, type Pointer } from 'bun:ffi';

import { BunnerRustError } from '../errors';

import type { RustError, BaseRustSymbols } from './interfaces';
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
      throw new Error('Failed to initialize RustCore');
    }

    this.symbols = lib.symbols as T;
    this.close = () => lib.close();

    const handle = this.symbols.init();

    if (!handle) {
      throw new Error('Failed to initialize Rust core');
    }

    this.handle = handle;
  }

  /**
   * Destroy the Rust core
   * @description Destroy the Rust core
   */
  destroy() {
    if (!this.handle) {
      throw new Error('Rust core not initialized');
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
        throw new BunnerRustError('Rust result is null');
      }

      const result = pointerToJson<T>(ptr, length);

      if (this.isError(result)) {
        throw this.makeError(result);
      }

      return result;
    } catch (error) {
      if (error instanceof BunnerRustError) {
        throw error;
      }

      throw new BunnerRustError('Failed to parse Rust result', error);
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
  protected isError(error: any): error is RustError {
    return Object.hasOwn(error, 'code') && Object.hasOwn(error, 'error');
  }

  /**
   * Make an error
   * @description Make an error
   * @param error
   * @returns
   */
  protected makeError(error: RustError) {
    if (!error.code) {
      return new BunnerRustError('UnknownError');
    }

    return new BunnerRustError(error.description, error);
  }
}
