import type { RestControllerDecoratorOptions } from './interfaces';

export function RestController(_path?: string, _options?: RestControllerDecoratorOptions) {
  return (_target: Function) => {};
}

export function Controller(_prefixOrOptions?: string | { path: string; host?: string | string[] }) {
  return (_target: Function) => {};
}
