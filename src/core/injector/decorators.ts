import { ModuleDecorator } from './constants';
import type { ModuleMetadata } from './interfaces';

/**
 * Module Decorator
 * Marks a class as a module and defines its metadata
 */
export function Module(metadata: ModuleMetadata) {
  return function (target: any) {
    Reflect.defineMetadata(ModuleDecorator, metadata, target);
  };
}
