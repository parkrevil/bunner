import type { Class } from './types';

/**
 * Check if a target is a constructor
 * @param target - The target to check
 * @returns True if the target is a constructor, false otherwise
 */
export function isClass(target: any): target is Class {
  return typeof target === 'function' && target.prototype;
}
