import type { JSCallbackEntry } from './interfaces';

/**
 * Rust Error Codes
 * @description The type for Rust error codes
 */
export type RustErrorCodes = Record<number, string>;

/**
 * JS Callback Map
 * @description The map for JS callbacks
 * @param T - The type for the result
 */
export type JSCallbackMap<T> = Map<string, JSCallbackEntry<T>>;
