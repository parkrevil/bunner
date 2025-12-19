import type { HttpMethodDecoratorOptions } from './interfaces';

function createHttpMethodDecorator() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return function (path?: string, options?: HttpMethodDecoratorOptions): MethodDecorator {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    return (target: object, propertyKey: string | symbol) => {};
  };
}

export const Get = createHttpMethodDecorator();
export const Post = createHttpMethodDecorator();
export const Put = createHttpMethodDecorator();
export const Delete = createHttpMethodDecorator();
export const Patch = createHttpMethodDecorator();
export const Options = createHttpMethodDecorator();
export const Head = createHttpMethodDecorator();
