import type { ControllerOptions, RestControllerDecoratorOptions } from './interfaces';
import type { ControllerDecoratorTarget } from './types';

export function RestController(_path?: string, _options?: RestControllerDecoratorOptions) {
  return (_target: ControllerDecoratorTarget) => {};
}

export function Controller(_prefixOrOptions?: string | ControllerOptions) {
  return (_target: ControllerDecoratorTarget) => {};
}
