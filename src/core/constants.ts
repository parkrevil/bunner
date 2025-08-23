/**
 * Decorator Symbols
 */
// Class Decorators
export const RestControllerDecorator = Symbol('rest-controller');
export const WebSocketControllerDecorator = Symbol('ws-controller');
export const InjectableDecorator = Symbol('injectable');

// Controller Method Decorators
export const GetDecorator = Symbol('get');
export const PostDecorator = Symbol('post');
export const PutDecorator = Symbol('put');
export const PatchDecorator = Symbol('patch');
export const DeleteDecorator = Symbol('delete');
export const OptionsDecorator = Symbol('options');
export const HeadDecorator = Symbol('head');

/**
 * HTTP Methods
 */
export const HttpMethod = {
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  PATCH: 'PATCH',
  DELETE: 'DELETE',
  OPTIONS: 'OPTIONS',
  HEAD: 'HEAD',
} as const;
