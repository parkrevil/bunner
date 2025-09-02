import { MetadataKey, type InjectableMetadata, type ModuleMetadata } from '../injector';
import type { InjectableDecoratorOptions, ModuleDecoratorOptions } from './interfaces';


/**
 * Module Decorator
 * Marks a class as a module and defines its metadata
 */
export function Module(metadata?: ModuleDecoratorOptions): ClassDecorator {
  return function<T extends Function>(target: T) {
    const moduleMetadata: ModuleMetadata = {
      providers: metadata?.providers ?? [],
      controllers: metadata?.controllers ?? [],
      imports: metadata?.imports ?? [],
      exports: metadata?.exports ?? [],
    };

    Reflect.defineMetadata(MetadataKey.Module, moduleMetadata, target);
  };
}

/**
 * Injectable Decorator
 * Marks a class as an injectable and defines its metadata
 */
export function Injectable(metadata?: InjectableDecoratorOptions): ClassDecorator {
  return function<T extends Function>(target: T) {
    const injectableMetadata: InjectableMetadata = {
      scope: metadata?.scope ?? 'singleton',
    };

    Reflect.defineMetadata(MetadataKey.Injectable, injectableMetadata, target);
  };
}
