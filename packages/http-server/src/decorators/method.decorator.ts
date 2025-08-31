import type { HttpMethod } from '../types';
import type { HttpMethodDecoratorMetadata, HttpMethodDecoratorOptions } from './interfaces';

/**
 * Get HTTP Method Decorator
 * @param path - Route path
 * @param options - Route options (optional)
 * @returns MethodDecorator
 */
export function Get(path?: string, options?: HttpMethodDecoratorMetadata): MethodDecorator {
  return defineHttpMethodDecorator('GET', path, options);
}

/**
 * Post HTTP Method Decorator
 * @param path - Route path
 * @param options - Route options (optional)
 * @returns MethodDecorator
 */
export function Post(path?: string, options?: HttpMethodDecoratorMetadata): MethodDecorator {
  return defineHttpMethodDecorator('POST', path, options);
}

/**
 * Put HTTP Method Decorator
 * @param path - Route path
 * @param options - Route options (optional)
 * @returns MethodDecorator
 */
export function Put(path?: string, options?: HttpMethodDecoratorMetadata): MethodDecorator {
  return defineHttpMethodDecorator('PUT', path, options);
}

/**
 * Patch HTTP Method Decorator
 * @param path - Route path
 * @param options - Route options (optional)
 * @returns MethodDecorator
 */
export function Patch(path?: string, options?: HttpMethodDecoratorMetadata): MethodDecorator {
  return defineHttpMethodDecorator('PATCH', path, options);
}

/**
 * Delete HTTP Method Decorator
 * @param path - Route path
 * @param options - Route options (optional)
 * @returns MethodDecorator
 */
export function Delete(path?: string, options?: HttpMethodDecoratorMetadata): MethodDecorator {
  return defineHttpMethodDecorator('DELETE', path, options);
}

/**
 * Options HTTP Method Decorator
 * @param path - Route path
 * @param options - Route options (optional)
 * @returns MethodDecorator
 */
export function Options(path?: string, options?: HttpMethodDecoratorMetadata): MethodDecorator {
  return defineHttpMethodDecorator('OPTIONS', path, options);
}

/**
 * Head HTTP Method Decorator
 * @param path - Route path
 * @param options - Route options (optional)
 * @returns MethodDecorator
 */
export function Head(path?: string, options?: HttpMethodDecoratorMetadata): MethodDecorator {
  return defineHttpMethodDecorator('HEAD', path, options);
}

/**
 * Define HTTP Method Decorator
 * @param httpMethod - HTTP Method
 * @param path - Route path or options
 * @param options - Route options
 * @returns MethodDecorator
 */
function defineHttpMethodDecorator(httpMethod: HttpMethod, path?: string, options?: HttpMethodDecoratorOptions): MethodDecorator {
  return function(target: Object, propertyKey: string | symbol, descriptor: TypedPropertyDescriptor<any>) {
    console.log('📦 HTTP Method Decorator', httpMethod, path, options);

    return descriptor;
  };
}