import type { ForwardRef } from '.';

/**
 * Forward Ref Decorator
 * @description ForwardRef decorator
 * @param fn 
 * @returns 
 */
export function forwardRef<T>(fn: () => T): ForwardRef {
  return { forwardRef: fn };
}

/**
 * Is Forward Ref
 * @description Checks if a value is a forward ref
 * @param value 
 * @returns 
 */
export function isForwardRef(value: any): value is ForwardRef {
  return value && typeof value.forwardRef === 'function';
}
