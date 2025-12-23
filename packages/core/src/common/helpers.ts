import type { Class } from '@bunner/common';

export function isClass(target: any): target is Class {
  return typeof target === 'function' && target.prototype;
}
