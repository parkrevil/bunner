/**
 * Decorator Symbols
 */
// Class Decorators
export const RestControllerDecorator = Symbol('rest-controller');

// Controller Method Decorators
export const HttpMethodDecorator = Symbol('http-method');

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
