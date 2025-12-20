import type { Class } from './types';

export function isClass(target: any): target is Class {
  return typeof target === 'function' && target.prototype;
}