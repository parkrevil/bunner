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
export interface RustError {
  code: number | null;
  message: string | null;
}
