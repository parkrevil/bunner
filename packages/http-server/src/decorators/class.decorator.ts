import type { ControllerDecoratorOptions } from './interfaces';

/**
 * Controller Decorators
 * @param options 
 * @returns 
 */
export function Controller(path?: string, options?: ControllerDecoratorOptions): ClassDecorator {
  return function<T extends Function>(target: T) {
    console.log('📦 Controller Decorator', path, options);

    return target;
  };
}
