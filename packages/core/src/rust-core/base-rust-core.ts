import { dlopen, type FFIFunction, type Pointer } from 'bun:ffi';

import { pointerToJson } from '../helpers';

import type { RustError, BaseRustSymbols } from './interfaces';
import type { RustErrorCodes } from './types';

export abstract class BaseRustCore<
  T extends BaseRustSymbols,
  E extends RustErrorCodes,
> {
  protected symbols: T;
  protected close: () => void;
  protected handle: Pointer;
  protected errorCodes: E;

  constructor(errorCodes: E) {
    this.errorCodes = errorCodes;
  }

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
   * @param value
   * @param canBeNull
   * @returns
   */
  protected ensure<T>(value: Pointer | null, canBeNull: true): T | undefined;
  protected ensure<T>(value: Pointer | null, canBeNull?: false): T;
  protected ensure<T>(value: Pointer | null, canBeNull = false): T | undefined {
    try {
      if (value === null && !canBeNull) {
        throw new Error('Value is null');
      }

      if (value === null) {
        return undefined as T;
      }

      const result = pointerToJson<T>(value);

      if (this.isError(result)) {
        throw this.makeError(result);
      }

      return result;
    } finally {
      if (value) {
        this.symbols.free_string(value);
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
    return Object.hasOwn(error, 'code') && Object.hasOwn(error, 'message');
  }

  /**
   * Make an error
   * @description Make an error
   * @param error
   * @returns
   */
  protected makeError(error: RustError) {
    if (!error.code || !this.errorCodes[error.code]) {
      return new Error('UnknownError');
    }

    return new Error(this.errorCodes[error.code]);
  }
}
