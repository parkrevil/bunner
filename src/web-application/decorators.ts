import { container } from '../core/container';
import { HttpMethod, HttpMethodDecorator, RestControllerDecorator } from './constants';
import type { RestControllerDecoratorOptions, RouteDecoratorOptions } from './interfaces';
import type { HttpMethodType } from './types';

/**
 * Class Decorators
 */
/**
 * Rest Controller Decorators
 * @param options 
 * @returns 
 */
export function RestController(options: RestControllerDecoratorOptions = {}): ClassDecorator {
  return function (target: any) {
    Reflect.defineMetadata(RestControllerDecorator, {
      path: options.path || '',
    }, target);

    container.registerController(target);
  };
}

/**
 * Method Decorators
 */
/**
 * Get HTTP Method Decorator
 * @param path - Route path
 * @param options - Route options (optional)
 * @returns MethodDecorator
 */
export function Get(path?: string, options?: RouteDecoratorOptions): MethodDecorator {
  return defineHttpMethodDecorator(HttpMethod.GET, path, options);
}

/**
 * Post HTTP Method Decorator
 * @param path - Route path
 * @param options - Route options (optional)
 * @returns MethodDecorator
 */
export function Post(path?: string, options?: RouteDecoratorOptions): MethodDecorator {
  return defineHttpMethodDecorator(HttpMethod.POST, path, options);
}

/**
 * Put HTTP Method Decorator
 * @param path - Route path
 * @param options - Route options (optional)
 * @returns MethodDecorator
 */
export function Put(path?: string, options?: RouteDecoratorOptions): MethodDecorator {
  return defineHttpMethodDecorator(HttpMethod.PUT, path, options);
}

/**
 * Patch HTTP Method Decorator
 * @param path - Route path
 * @param options - Route options (optional)
 * @returns MethodDecorator
 */
export function Patch(path?: string, options?: RouteDecoratorOptions): MethodDecorator {
  return defineHttpMethodDecorator(HttpMethod.PATCH, path, options);
}

/**
 * Delete HTTP Method Decorator
 * @param path - Route path
 * @param options - Route options (optional)
 * @returns MethodDecorator
 */
export function Delete(path?: string, options?: RouteDecoratorOptions): MethodDecorator {
  return defineHttpMethodDecorator(HttpMethod.DELETE, path, options);
}

/**
 * Options HTTP Method Decorator
 * @param path - Route path
 * @param options - Route options (optional)
 * @returns MethodDecorator
 */
export function Options(path?: string, options?: RouteDecoratorOptions): MethodDecorator {
  return defineHttpMethodDecorator(HttpMethod.OPTIONS, path, options);
}

/**
 * Head HTTP Method Decorator
 * @param path - Route path
 * @param options - Route options (optional)
 * @returns MethodDecorator
 */
export function Head(path?: string, options?: RouteDecoratorOptions): MethodDecorator {
  return defineHttpMethodDecorator(HttpMethod.HEAD, path, options);
}

/**
 * Define HTTP Method Decorator
 * @param method - HTTP Method
 * @param path - Route path or options
 * @param options - Route options
 * @returns MethodDecorator
 */
function defineHttpMethodDecorator(method: HttpMethodType, path?: string, options?: RouteDecoratorOptions): MethodDecorator {
  return function (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    Reflect.defineMetadata(HttpMethodDecorator, {
      method: method,
      path: path ?? '',
      options: options ?? {},
      handler: propertyKey
    }, target, propertyKey);
  };
}