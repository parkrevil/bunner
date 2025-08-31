import type { InjectableMetadata, ModuleMetadata } from './interfaces';

/**
 * Module Decorator
 * Marks a class as a module and defines its metadata
 */
export function Module(metadata?: ModuleMetadata): ClassDecorator {
  return function<T extends Function>(target: T) {
    console.log('📦 Module Decorator');

    return target;
  };
}

/**
 * Injectable Decorator
 * Marks a class as an injectable and defines its metadata
 */
export function Injectable(metadata?: InjectableMetadata): ClassDecorator {
  return function<T extends Function>(target: T) {
    console.log('📦 Injectable Decorator');

    return target;
  };
}
