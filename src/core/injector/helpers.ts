import type { ForwardRef } from './interfaces';
import type { Constructor } from './types';

/**
 * Check if a value is a constructor
 */
export function isConstructor(cls: any): cls is new (...args: any[]) => any {
  return typeof cls === 'function' && !!cls.prototype;
}

/**
 * Create a ForwardRef
 */
export function forwardRef<T>(fn: () => Constructor<T>): ForwardRef<T> {
  return { forwardRef: fn };
}

/**
 * Check if a value is a ForwardRef
 */
export function isForwardRef(value: any): value is ForwardRef<any> {
  return !!value && typeof value.forwardRef === 'function';
}

/**
 * Resolve an injection token to a concrete constructor
 */
export function resolveTokenTarget(token: any): Constructor {
  const target = isForwardRef(token) ? token.forwardRef() : token;

  if (!isConstructor(target)) {
    throw new Error(`Invalid injection token: ${String(target)}`);
  }

  return target as Constructor;
}
