import type { Pointer } from 'bun:ffi';

import type { JSCallbackEntry } from './interfaces';

/**
 * JS Callback Map
 * @description The map for JS callbacks
 * @param T - The type for the result
 */
export type JSCallbackMap<T> = Map<string, JSCallbackEntry<T>>;

/**
 * Free Pointer Function
 * @description The function to free a pointer
 * @param ptr - The pointer to free
 */
export type FreePointerFn = (ptr: Pointer) => void;

/**
 * Ffi Function Metadata
 * @description The metadata for an FFI function
 */
export type FfiFunctionMetadata = Map<number, FfiPointerValueType>;

/**
 * Ffi Pointer Value Type
 * @description The type of value stored in an FFI pointer
 */
export type FfiPointerValueType = 'string' | 'object' | 'result';
