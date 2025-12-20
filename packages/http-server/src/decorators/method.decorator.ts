import type { HttpMethodDecoratorOptions } from './interfaces';

function createHttpMethodDecorator(_method: string) {
  return function (_pathOrOptions?: string | HttpMethodDecoratorOptions, _options?: HttpMethodDecoratorOptions) {
    return (_target: object, _propertyKey: string | symbol, _descriptor: PropertyDescriptor) => {};
  };
}

export const Get = createHttpMethodDecorator('Get');
export const Post = createHttpMethodDecorator('Post');
export const Put = createHttpMethodDecorator('Put');
export const Delete = createHttpMethodDecorator('Delete');
export const Patch = createHttpMethodDecorator('Patch');
export const Options = createHttpMethodDecorator('Options');
export const Head = createHttpMethodDecorator('Head');
