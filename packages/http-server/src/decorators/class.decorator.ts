import type { ControllerDecoratorOptions, ControllerMetadata } from './interfaces';
import { MetadataKey } from './constants';


/**
 * Controller Decorators
 * @param path - The base path for the controller
 * @param options - The controller options
 * @returns ClassDecorator
 */
export function Controller(path?: string, options?: ControllerDecoratorOptions): ClassDecorator {
  return function<T extends Function>(target: T) {
    const controllerMetadata: ControllerMetadata = {
      target,
      path,
      options,
    };

    Reflect.defineMetadata(MetadataKey.Controller, controllerMetadata, target);
  };
}
