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
