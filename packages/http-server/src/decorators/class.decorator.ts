import { MetadataKey } from './constants';
import type {
  RestControllerDecoratorOptions,
  RestControllerMetadata,
} from './interfaces';

/**
 * Controller Decorators
 * @param path - The base path for the controller
 * @param options - The controller options
 * @returns ClassDecorator
 */
export function RestController(
  path?: string,
  options?: RestControllerDecoratorOptions,
): ClassDecorator {
  return function <T extends Function>(target: T) {
    const controllerMetadata: RestControllerMetadata = {
      target,
      path,
      options,
    };

    Reflect.defineMetadata(
      MetadataKey.RestController,
      controllerMetadata,
      target,
    );
  };
}
