import type { ControllerOptions, RestControllerDecoratorOptions } from './interfaces';

export function RestController(_path?: string, _options?: RestControllerDecoratorOptions): ClassDecorator {
  return () => {};
}

export function Controller(_prefixOrOptions?: string | ControllerOptions): ClassDecorator {
  return () => {};
}
