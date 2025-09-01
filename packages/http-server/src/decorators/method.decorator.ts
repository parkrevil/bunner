import { HttpMethod } from '../constants';
import type { HttpMethodValue } from '../types';
import type { HttpMethodDecoratorOptions } from './interfaces';

function createHttpMethodDecorator(method: HttpMethodValue) {
  return function(path?: string, options?: HttpMethodDecoratorOptions): MethodDecorator {
    return function(target: Object, propertyKey: string | symbol, descriptor: TypedPropertyDescriptor<any>) {
    };
  };
}

export const Get = createHttpMethodDecorator(HttpMethod.Get);
export const Post = createHttpMethodDecorator(HttpMethod.Post);
export const Put = createHttpMethodDecorator(HttpMethod.Put);
export const Delete = createHttpMethodDecorator(HttpMethod.Delete);
export const Patch = createHttpMethodDecorator(HttpMethod.Patch);
export const Options = createHttpMethodDecorator(HttpMethod.Options);
export const Head = createHttpMethodDecorator(HttpMethod.Head);
