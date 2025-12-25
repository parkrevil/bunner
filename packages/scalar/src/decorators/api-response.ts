import type { ApiResponseOptions } from './interfaces';

/**
 * Declares an OpenAPI response for a route handler.
 *
 * @param _options Response options.
 * @returns A method decorator.
 */
export function ApiResponse(_options: ApiResponseOptions): MethodDecorator {
  return () => {};
}

/**
 * Declares a 200 (OK) OpenAPI response for a route handler.
 *
 * @param _options Response options without status.
 * @returns A method decorator.
 */
export function ApiOkResponse(_options?: Omit<ApiResponseOptions, 'status'>): MethodDecorator {
  return () => {};
}

/**
 * Declares a 201 (Created) OpenAPI response for a route handler.
 *
 * @param _options Response options without status.
 * @returns A method decorator.
 */
export function ApiCreatedResponse(_options?: Omit<ApiResponseOptions, 'status'>): MethodDecorator {
  return () => {};
}

/**
 * Declares a 404 (Not Found) OpenAPI response for a route handler.
 *
 * @param _options Response options without status.
 * @returns A method decorator.
 */
export function ApiNotFoundResponse(_options?: Omit<ApiResponseOptions, 'status'>): MethodDecorator {
  return () => {};
}
