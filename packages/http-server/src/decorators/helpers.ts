import type { HttpMethod } from '../types';
import type { RouteHandlerMetadata } from './interfaces';

export function createHttpMethodDecorator(method: HttpMethod) {
  return function(path?: string): MethodDecorator {
    return function(target: any, propertyKey: string | symbol) {
      const routes: RouteHandlerMetadata[] = target.constructor.__routes ?? [];

      routes.push({
        target: target.constructor,
        propertyKey: propertyKey.toString(),
        path,
        httpMethod: method,
      });

      target.constructor.__routes = routes;
    };
  };
}
