import type { Pointer } from 'bun:ffi';

import { stringPointerToJson } from '../helpers';

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

  constructor(symbols: any, close: () => void, errorCodes: E) {
    if (!symbols) {
      throw new Error('Failed to initialize RustCore');
    }

    this.symbols = symbols;
    this.close = close;
    this.errorCodes = errorCodes;

    const handle = this.symbols.init();

    if (handle === null) {
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
  }

  /**
   * Ensure a value is not null
   * @description Ensure a value is not null
   * @param value
   * @param canBeNull
   * @returns
   */
  protected ensure<T>(value: Pointer | null, canBeNull = false): T | undefined {
    if (value === null && !canBeNull) {
      throw new Error('Value is null');
    }

    if (value === null) {
      return undefined as T;
    }

    const result = stringPointerToJson<T>(value);

    this.symbols.free_string(value);

    if (this.isError(result)) {
      throw this.makeError(result);
    }

    return result;
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
