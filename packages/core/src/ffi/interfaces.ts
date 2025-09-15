import type { Pointer } from 'bun:ffi';

import type { FfiPointerValueType, FreePointerFn } from './types';

/**
 * Base FFI Symbols
 * @description The base symbols for a Rust core
 */
export interface BaseFfiSymbols {
  init: (...args: any[]) => Pointer | null;
  destroy: (handle: Pointer) => void;
  free_string: FreePointerFn;
}

/**
 * FFI Error Report
 * @description The structure of an error report from FFI
 */
export interface FfiErrorReport {
  code: number;
  error: string;
  subsystem: string;
  stage: string;
  cause: string;
  ts: number;
  thread: string;
  version: string;
  description: string;
  extra: any;
}

/**
 * JS Callback Entry
 * @description The entry for a JS callback
 * @param T - The type for the result
 */
export interface JSCallbackEntry<T> {
  resolve: (v: T) => void;
  reject?: (e: unknown) => void;
}

/**
 * Ffi Pointer Constructor Params
 * @description The parameters for constructing an FfiPointer
 */
export interface FfiPointerConstructorParams {
  type: FfiPointerValueType;
  pointer: Pointer | null;
  length: number;
  freeFn: FreePointerFn;
}
