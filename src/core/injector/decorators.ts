import { InjectableDecorator, InjectDecorator, ModuleDecorator } from './constants';
import type { ModuleMetadata } from './interfaces';

/**
 * Injectable Decorator
 * Marks a class as injectable
 */
export function Injectable() {
  return function (target: any) {
    Reflect.defineMetadata(InjectableDecorator, true, target);
  };
}

/**
 * Module Decorator
 * Marks a class as a module and defines its metadata
 */
export function Module(metadata: ModuleMetadata) {
  return function (target: any) {
    Reflect.defineMetadata(ModuleDecorator, metadata, target);
  };
}

/**
 * Inject Decorator for constructor parameters
 */
export function Inject(token: any): ParameterDecorator {
  return function (target: Object, propertyKey: string | symbol | undefined, parameterIndex: number) {
    const existing: any[] = Reflect.getOwnMetadata(InjectDecorator, target) || [];
    existing[parameterIndex] = token;
    Reflect.defineMetadata(InjectDecorator, existing, target);
  };
}
