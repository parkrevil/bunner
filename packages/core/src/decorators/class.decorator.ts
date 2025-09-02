import {
  MetadataKey,
  type InjectableMetadata,
  type ModuleMetadata,
} from '../injector';

import type {
  InjectableDecoratorOptions,
  ModuleDecoratorOptions,
} from './interfaces';

/**
 * Module Decorator
 * Marks a class as a module and defines its metadata
 */
export function Module(options?: ModuleDecoratorOptions): ClassDecorator {
  return function <T extends Function>(target: T) {
    const moduleMetadata: ModuleMetadata = {
      providers: options?.providers ?? [],
      controllers: options?.controllers ?? [],
      imports: options?.imports ?? [],
      exports: options?.exports ?? [],
    };

    Reflect.defineMetadata(MetadataKey.Module, moduleMetadata, target);
  };
}

/**
 * Injectable Decorator
 * Marks a class as an injectable and defines its metadata
 */
export function Injectable(
  options?: InjectableDecoratorOptions,
): ClassDecorator {
  return function <T extends Function>(target: T) {
    const injectableMetadata: InjectableMetadata = {
      scope: options?.scope ?? 'singleton',
    };

    Reflect.defineMetadata(MetadataKey.Injectable, injectableMetadata, target);
  };
}
