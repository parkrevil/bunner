import { HTTP_METHOD } from '../constants';
import type { HttpMethodValue } from '../types';

import { METADATA_KEY } from './constants';
import type {
  HttpMethodDecoratorOptions,
  RestRouteHandlerMetadata,
} from './interfaces';

/**
 * Create HTTP method decorator
 * @description Create a HTTP method decorator
 * @param httpMethod
 * @returns
 */
function createHttpMethodDecorator(httpMethod: HttpMethodValue) {
  return function (
    path?: string,
    options?: HttpMethodDecoratorOptions,
  ): MethodDecorator {
    return function (target: object, propertyKey: string | symbol) {
      const routeMetadata: RestRouteHandlerMetadata = {
        httpMethod,
        path,
        options,
      };

      Reflect.defineMetadata(
        METADATA_KEY.ROUTE_HANDLER,
        routeMetadata,
        target,
        propertyKey,
      );
    };
  };
}

/**
 * Get HTTP method decorator
 * @description Create a HTTP method decorator
 * @returns
 */
export const Get = createHttpMethodDecorator(HTTP_METHOD.GET);

/**
 * Post HTTP method decorator
 * @description Create a HTTP method decorator
 * @returns
 */
export const Post = createHttpMethodDecorator(HTTP_METHOD.POST);

/**
 * Put HTTP method decorator
 * @description Create a HTTP method decorator
 * @returns
 */
export const Put = createHttpMethodDecorator(HTTP_METHOD.PUT);

/**
 * Delete HTTP method decorator
 * @description Create a HTTP method decorator
 * @returns
 */
export const Delete = createHttpMethodDecorator(HTTP_METHOD.DELETE);

/**
 * Patch HTTP method decorator
 * @description Create a HTTP method decorator
 * @returns
 */
export const Patch = createHttpMethodDecorator(HTTP_METHOD.PATCH);

/**
 * Options HTTP method decorator
 * @description Create a HTTP method decorator
 * @returns
 */
export const Options = createHttpMethodDecorator(HTTP_METHOD.OPTIONS);

/**
 * Head HTTP method decorator
 * @description Create a HTTP method decorator
 * @returns
 */
export const Head = createHttpMethodDecorator(HTTP_METHOD.HEAD);
