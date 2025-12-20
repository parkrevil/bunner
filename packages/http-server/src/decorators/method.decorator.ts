import { MetadataStorage } from '@bunner/core';

import type { HttpMethodDecoratorOptions } from './interfaces';

// Helper to Create Method Decorator
function createHttpMethodDecorator(method: string) {
  return function (pathOrOptions?: string | HttpMethodDecoratorOptions, options?: HttpMethodDecoratorOptions) {
    let path = '/';
    if (typeof pathOrOptions === 'string') {
      path = pathOrOptions;
    } else if (pathOrOptions && typeof pathOrOptions === 'object') {
      options = pathOrOptions;
    }

    return (target: object, propertyKey: string | symbol, _descriptor: PropertyDescriptor) => {
      MetadataStorage.addDecoratorMetadata(target, propertyKey, {
        name: method,
        arguments: [path],
        options,
      });
    };
  };
}

export const Get = createHttpMethodDecorator('Get');
export const Post = createHttpMethodDecorator('Post');
export const Put = createHttpMethodDecorator('Put');
export const Delete = createHttpMethodDecorator('Delete');
export const Patch = createHttpMethodDecorator('Patch');
export const Options = createHttpMethodDecorator('Options');
export const Head = createHttpMethodDecorator('Head');
