import type { Pointer } from 'bun:ffi';

import { BunnerFfiError } from './errors';
import { isFfiErrorReport, makeFfiError } from './helpers';
import type { FfiPointerConstructorParams } from './interfaces';
import type { FfiPointerValueType, FreePointerFn } from './types';
import { pointerToString, pointerToJson, isPointer } from './utils';

export class FfiPointer<T> {
  private readonly freeFn: FreePointerFn;
  private readonly length: number;
  private type: FfiPointerValueType;
  private pointer: Pointer | null;
  private freed: boolean;

  constructor(params: FfiPointerConstructorParams) {
    this.type = params.type;
    this.pointer = params.pointer;
    this.length = params.length;
    this.freeFn = params.freeFn;

    this.freed = false;
  }

  isValid(val?: any): val is Pointer {
    if (val === undefined) {
      val = this.pointer;
    }

    return isPointer(val);
  }

  ensure(): T | undefined {
    try {
      if (!this.isValid(this.pointer)) {
        return undefined;
      }

      if (this.type === 'string') {
        return pointerToString(this.pointer, this.length) as unknown as T;
      } else if (this.type === 'object') {
        return pointerToJson<T>(this.pointer, this.length);
      } else if (this.type === 'result') {
        const result = pointerToJson<T>(this.pointer, this.length);

        if (isFfiErrorReport(result)) {
          throw makeFfiError(result);
        }

        return result;
      }

      return undefined;
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
