import { decorate, injectable } from 'inversify';
import { RestControllerDecorator } from './constants';
import type { RestControllerDecoratorMetadata, RestControllerDecoratorOptions } from './interfaces';

/**
 * Rest Controller Decorators
 * @param options 
 * @returns 
 */
export function RestController(path?: string, options?: RestControllerDecoratorOptions): ClassDecorator {
  return function (target: any) {
    try { decorate(injectable(), target); } catch { }

    Reflect.defineMetadata(RestControllerDecorator, {
      path,
      ...options,
    } as RestControllerDecoratorMetadata, target);
  };
}
