import type { Class } from '../types';
import { INJECT_DEPS_KEY, metadataRegistry } from './constants';
import type { InjectableDecoratorOptions, InjectableMetadata, ModuleDecoratorOptions } from './interfaces';

/**
 * Module Decorator
 * Marks a class as a module and defines its metadata
 */
export function Module(metadata?: ModuleDecoratorOptions): ClassDecorator {
  return function<T extends Function>(target: T) {
  };
}

/**
 * Injectable Decorator
 * Marks a class as an injectable and defines its metadata
 */
export function Injectable(metadata?: InjectableDecoratorOptions): ClassDecorator {
  return function<T extends Function>(target: T) {
  };
}
