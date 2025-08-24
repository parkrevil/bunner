import type { Constructor } from './types';

export interface ModuleMetadata {
  providers?: Constructor[];
  controllers?: Constructor[];
  imports?: Array<Constructor | ForwardRef>;
  exports?: Constructor[];
}

/**
 * ForwardRef wrapper to defer resolving circular references
 */
export interface ForwardRef<T = any> {
  forwardRef: () => Constructor<T>;
}
