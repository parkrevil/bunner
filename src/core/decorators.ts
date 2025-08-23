import { DeleteDecorator, GetDecorator, HeadDecorator, HttpMethod, InjectableDecorator, OptionsDecorator, PatchDecorator, PostDecorator, PutDecorator, RestControllerDecorator, WebSocketControllerDecorator } from './constants';
import type { RestControllerDecoratorOptions, RouteDecoratorOptions, WebSocketControllerDecoratorOptions } from './interfaces';

/**
 * Class Decorators
 */
/**
 * Rest Controller Decorators
 * @param options 
 * @returns 
 */
export function RestController(options: RestControllerDecoratorOptions = {}) {
  return function (target: any) {
    Reflect.defineMetadata(RestControllerDecorator, {
      path: options.path || '',
    }, target);
  };
}

/**
 * WebSocket Controller Decorators
 * @param options 
 * @returns 
 */
export function WebSocketController(options: WebSocketControllerDecoratorOptions = {}) {
  return function (target: any) {
    Reflect.defineMetadata(WebSocketControllerDecorator, {
      group: options.group || '',
    }, target);
  };
}

/**
 * Injectable Decorators
 * @returns 
 */
export function Injectable() {
  return function (target: any) {
    Reflect.defineMetadata(InjectableDecorator, true, target);
  };
}

/**
 * Method Decorators
 */
/**
 * Get HTTP Method Decorator
 * @param options RouteDecoratorOptions
 * @returns MethodDecorator
 */
export function Get(options: RouteDecoratorOptions = {}) {
  return function (target: any) {
    Reflect.defineMetadata(GetDecorator, {
      method: HttpMethod.GET,
      path: options.path || '',
    }, target);
  };
}
/**
 * Post HTTP Method Decorator
 * @param options RouteDecoratorOptions
 * @returns MethodDecorator
 */
export function Post(options: RouteDecoratorOptions = {}) {
  return function (target: any) {
    Reflect.defineMetadata(PostDecorator, {
      method: HttpMethod.POST,
      path: options.path || '',
    }, target);
  };
}

/**
 * Put HTTP Method Decorator
 * @param options RouteDecoratorOptions
 * @returns MethodDecorator
 */
export function Put(options: RouteDecoratorOptions = {}) {
  return function (target: any) {
    Reflect.defineMetadata(PutDecorator, {
      method: HttpMethod.PUT,
      path: options.path || '',
    }, target);
  };
}

/**
 * Patch HTTP Method Decorator
 * @param options RouteDecoratorOptions
 * @returns MethodDecorator
 */
export function Patch(options: RouteDecoratorOptions = {}) {
  return function (target: any) {
    Reflect.defineMetadata(PatchDecorator, {
      method: HttpMethod.PATCH,
      path: options.path || '',
    }, target);
  };
}

/**
 * Delete HTTP Method Decorator
 * @param options RouteDecoratorOptions
 * @returns MethodDecorator
 */
export function Delete(options: RouteDecoratorOptions = {}) {
  return function (target: any) {
    Reflect.defineMetadata(DeleteDecorator, {
      method: HttpMethod.DELETE,
      path: options.path || '',
    }, target);
  };
}

/**
 * Options HTTP Method Decorator
 * @param options RouteDecoratorOptions
 * @returns MethodDecorator
 */
export function Options(options: RouteDecoratorOptions = {}) {
  return function (target: any) {
    Reflect.defineMetadata(OptionsDecorator, {
      method: HttpMethod.OPTIONS,
      path: options.path || '',
    }, target);
  };
}

/**
 * Head HTTP Method Decorator
 * @param options RouteDecoratorOptions
 * @returns MethodDecorator
 */
export function Head(options: RouteDecoratorOptions = {}) {
  return function (target: any) {
    Reflect.defineMetadata(HeadDecorator, {
      method: HttpMethod.HEAD,
      path: options.path || '',
    }, target);
  };
}
