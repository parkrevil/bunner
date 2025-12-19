import type { RestControllerDecoratorOptions } from './interfaces';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function RestController(path?: string, options?: RestControllerDecoratorOptions): ClassDecorator {
  return (target: any) => target;
}
