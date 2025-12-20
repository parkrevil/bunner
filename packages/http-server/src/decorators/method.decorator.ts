import { MetadataStorage } from '@bunner/core';

import type { HttpMethodDecoratorOptions } from './interfaces';

// Helper to Create Standard Method Decorator
function createHttpMethodDecorator(method: string) {
  return function (pathOrOptions?: string | HttpMethodDecoratorOptions, options?: HttpMethodDecoratorOptions) {
    let path = '/';
    if (typeof pathOrOptions === 'string') {
      path = pathOrOptions;
    } else if (pathOrOptions && typeof pathOrOptions === 'object') {
      options = pathOrOptions;
    }

    return (value: any, context: ClassMethodDecoratorContext) => {
      if (context.kind !== 'method') {
        throw new Error(`@${method} must be used on a method. Used on: ${context.kind}`);
      }

      MetadataStorage.addDecoratorMetadata(context, {
        name: method,
        arguments: [path],
        options,
      });

      return value;
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
