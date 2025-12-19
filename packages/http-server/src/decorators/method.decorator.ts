import type { HttpMethodDecoratorOptions } from './interfaces';

function createHttpMethodDecorator() {
  return function (_path?: string, _options?: HttpMethodDecoratorOptions): MethodDecorator {
    return (_target: object, _propertyKey: string | symbol) => {};
  };
}

export const Get = createHttpMethodDecorator();
export const Post = createHttpMethodDecorator();
export const Put = createHttpMethodDecorator();
export const Delete = createHttpMethodDecorator();
export const Patch = createHttpMethodDecorator();
export const Options = createHttpMethodDecorator();
export const Head = createHttpMethodDecorator();
