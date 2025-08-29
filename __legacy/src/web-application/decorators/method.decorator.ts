import { HttpMethod } from '../constants';
import type { HttpMethodDecoratorOptions, HttpMethodDecoratorMetadata } from './interfaces';
import { HttpMethodDecorator } from './constants';
import type { HttpMethodValue } from '../types';

/**
 * Get HTTP Method Decorator
 * @param path - Route path
 * @param options - Route options (optional)
 * @returns MethodDecorator
 */
export function Get(path?: string, options?: HttpMethodDecoratorOptions): MethodDecorator {
  return defineHttpMethodDecorator(HttpMethod.Get, path, options);
}

/**
 * Post HTTP Method Decorator
 * @param path - Route path
 * @param options - Route options (optional)
 * @returns MethodDecorator
 */
export function Post(path?: string, options?: HttpMethodDecoratorOptions): MethodDecorator {
  return defineHttpMethodDecorator(HttpMethod.Post, path, options);
}

/**
 * Put HTTP Method Decorator
 * @param path - Route path
 * @param options - Route options (optional)
 * @returns MethodDecorator
 */
export function Put(path?: string, options?: HttpMethodDecoratorOptions): MethodDecorator {
  return defineHttpMethodDecorator(HttpMethod.Put, path, options);
}

/**
 * Patch HTTP Method Decorator
 * @param path - Route path
 * @param options - Route options (optional)
 * @returns MethodDecorator
 */
export function Patch(path?: string, options?: HttpMethodDecoratorOptions): MethodDecorator {
  return defineHttpMethodDecorator(HttpMethod.Patch, path, options);
}

/**
 * Delete HTTP Method Decorator
 * @param path - Route path
 * @param options - Route options (optional)
 * @returns MethodDecorator
 */
export function Delete(path?: string, options?: HttpMethodDecoratorOptions): MethodDecorator {
  return defineHttpMethodDecorator(HttpMethod.Delete, path, options);
}

/**
 * Options HTTP Method Decorator
 * @param path - Route path
 * @param options - Route options (optional)
 * @returns MethodDecorator
 */
export function Options(path?: string, options?: HttpMethodDecoratorOptions): MethodDecorator {
  return defineHttpMethodDecorator(HttpMethod.Options, path, options);
}

/**
 * Head HTTP Method Decorator
 * @param path - Route path
 * @param options - Route options (optional)
 * @returns MethodDecorator
 */
export function Head(path?: string, options?: HttpMethodDecoratorOptions): MethodDecorator {
  return defineHttpMethodDecorator(HttpMethod.Head, path, options);
}

/**
 * Define HTTP Method Decorator
 * @param httpMethod - HTTP Method
 * @param path - Route path or options
 * @param options - Route options
 * @returns MethodDecorator
 */
function defineHttpMethodDecorator(httpMethod: HttpMethodValue, path?: string, options?: HttpMethodDecoratorOptions): MethodDecorator {
  return function (target: any, propertyKey: string | symbol) {
    Reflect.defineMetadata(HttpMethodDecorator, {
      httpMethod,
      path,
      ...options,
    } as HttpMethodDecoratorMetadata, target, propertyKey);
  };
}