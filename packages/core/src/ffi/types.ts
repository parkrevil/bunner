import type { Pointer } from 'bun:ffi';

/**
 * App ID
 * @description The type for the application ID
 */
export type AppId = number;

/**
 * Free Pointer Function
 * @description The function to free a pointer
 * @param ptr - The pointer to free
 */
export type FreePointerFn = (appId: AppId, ptr: Pointer) => number;

/**
 * Ffi Stringable
 * @description The types that can be converted to a string for FFI
 */
export type FfiStringable = string | object | Map<any, any> | Array<any>;

/**
 * Ffi Pointer Free Function
 * @description The function to free a pointer
 * @param ptr - The pointer to free
 */
export type FfiPointerFreeFn = (ptr: Pointer) => void;
