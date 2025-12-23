import type { ForwardRef } from './interfaces';
import type { Class } from './types';

export function isClass(target: any): target is Class {
  return typeof target === 'function' && target.prototype;
}

export function forwardRef(fn: () => any): ForwardRef {
  return { forwardRef: fn };
}

export function isUndefined(obj: any): obj is undefined {
  return typeof obj === 'undefined';
}

export function isNil(obj: any): obj is null | undefined {
  return isUndefined(obj) || obj === null;
}

export function isEmpty(array: any): boolean {
  return !(array && array.length > 0);
}

export function isSymbol(fn: any): fn is symbol {
  return typeof fn === 'symbol';
}

export function isString(fn: any): fn is string {
  return typeof fn === 'string';
}

export function isFunction(fn: any): boolean {
  return typeof fn === 'function';
}
