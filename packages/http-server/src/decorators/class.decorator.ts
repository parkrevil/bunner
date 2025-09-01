import type { ControllerDecoratorOptions, ControllerMetadata } from './interfaces';

/**
 * Controller Decorators
 * @param options 
 * @returns 
 */
export function Controller(path?: string, options?: ControllerDecoratorOptions): ClassDecorator {
  return function<T extends Function>(target: T) {
  };
}
