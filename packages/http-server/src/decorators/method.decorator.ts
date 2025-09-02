import { HttpMethod } from '../constants';
import type { HttpMethodValue } from '../types';
import type { HttpMethodDecoratorOptions, RestRouteHandlerMetadata } from './interfaces';
import { MetadataKey } from './constants';


/**
 * Create HTTP method decorator
 * @description Create a HTTP method decorator
 * @param httpMethod 
 * @returns 
 */
function createHttpMethodDecorator(httpMethod: HttpMethodValue) {
  return function(path?: string, options?: HttpMethodDecoratorOptions): MethodDecorator {
    return function(target: Object, propertyKey: string | symbol, descriptor: TypedPropertyDescriptor<any>) {
      const routeMetadata: RestRouteHandlerMetadata = {
        target: target.constructor,
        propertyKey,
        httpMethod,
        path,
        options,
      };

      Reflect.defineMetadata(MetadataKey.RouteHandler, routeMetadata, target, propertyKey);
    };
  };
}

/**
 * Get HTTP method decorator
 * @description Create a HTTP method decorator
 * @returns 
 */
export const Get = createHttpMethodDecorator(HttpMethod.Get);

/**
 * Post HTTP method decorator
 * @description Create a HTTP method decorator
 * @returns 
 */
export const Post = createHttpMethodDecorator(HttpMethod.Post);

/**
 * Put HTTP method decorator
 * @description Create a HTTP method decorator
 * @returns 
 */
export const Put = createHttpMethodDecorator(HttpMethod.Put);

/**
 * Delete HTTP method decorator
 * @description Create a HTTP method decorator
 * @returns 
 */
export const Delete = createHttpMethodDecorator(HttpMethod.Delete);

/**
 * Patch HTTP method decorator
 * @description Create a HTTP method decorator
 * @returns 
 */
export const Patch = createHttpMethodDecorator(HttpMethod.Patch);

/**
 * Options HTTP method decorator
 * @description Create a HTTP method decorator
 * @returns 
 */
export const Options = createHttpMethodDecorator(HttpMethod.Options);

/**
 * Head HTTP method decorator
 * @description Create a HTTP method decorator
 * @returns 
 */
export const Head = createHttpMethodDecorator(HttpMethod.Head);
