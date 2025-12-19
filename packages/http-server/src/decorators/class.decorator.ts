import type { RestControllerDecoratorOptions } from './interfaces';

export function RestController(_path?: string, _options?: RestControllerDecoratorOptions): ClassDecorator {
  return (target: any) => target;
}
