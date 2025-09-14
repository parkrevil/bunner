import type { Pointer } from 'bun:ffi';

/**
 * Base Rust Symbols
 * @description The base symbols for a Rust core
 */
export interface BaseRustSymbols {
  init: (...args: any[]) => Pointer | null;
  destroy: (handle: Pointer) => void;
  free_string: (ptr: Pointer) => void;
}

/**
 * Rust Error
 * @description The error interface for Rust
 */
export interface FfiError {
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
