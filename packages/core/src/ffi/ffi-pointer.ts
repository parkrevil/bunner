import type { Pointer } from 'bun:ffi';

import { BunnerFfiError } from './errors';
import { isFfiErrorReport, makeFfiError } from './helpers';
import type { FreePointerFn } from './types';
import { pointerToJson, isPointer, pointerToString } from './utils';

export class FfiPointer {
  private readonly freeFn: FreePointerFn;
  private pointer: Pointer | null;
  private freed: boolean;

  constructor(pointer: Pointer | null, freeFn: FreePointerFn) {
    this.pointer = pointer;
    this.freeFn = freeFn;
    this.freed = false;
  }

  isValid(val?: any): val is Pointer {
    if (val === undefined) {
      val = this.pointer;
    }

    return isPointer(val);
  }

  toString(): string | undefined {
    try {
      if (!this.isValid(this.pointer)) {
        return undefined;
      }

      return pointerToString(this.pointer);
    } catch (e) {
      throw new BunnerFfiError('Failed to parse FFI result', e);
    } finally {
      this.free();
    }
  }

  toObject<T>(): T | undefined {
    try {
      if (!this.isValid(this.pointer)) {
        return undefined;
      }

      return pointerToJson<T>(this.pointer);
    } catch (e) {
      throw new BunnerFfiError('Failed to parse FFI result', e);
    } finally {
      this.free();
    }
  }

  toResult<T>(): T | undefined {
    try {
      if (!this.isValid(this.pointer)) {
        return undefined;
      }

      const result = pointerToJson<T>(this.pointer);

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
      this.free();
    }
  }

  free() {
    if (this.freed) {
      return;
    }

    if (!this.isValid(this.pointer)) {
      this.freed = true;

      return;
    }

    try {
      this.freeFn(this.pointer);
    } finally {
      this.freed = true;
      this.pointer = null;
    }
  }
}
