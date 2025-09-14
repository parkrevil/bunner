import type { JSCallbackEntry } from './interfaces';

/**
 * JS Callback Map
 * @description The map for JS callbacks
 * @param T - The type for the result
 */
export type JSCallbackMap<T> = Map<string, JSCallbackEntry<T>>;
