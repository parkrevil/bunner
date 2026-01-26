import type { ApiBodyOptions, ApiParamOptions, ApiQueryOptions } from './interfaces';

/**
 * Declares OpenAPI tag(s) for a controller.
 *
 * @param _tags Tag names.
 * @returns A class decorator.
 */
export function ApiTags(..._tags: string[]): ClassDecorator {
  return () => {};
}

/**
 * Declares bearer auth requirement for a controller.
 *
 * @returns A class decorator.
 */
export function ApiBearerAuth(): ClassDecorator {
  return () => {};
}

/**
 * Declares OpenAPI request body schema for a route handler.
 *
 * @param _options Body options.
 * @returns A method decorator.
 */
export function ApiBody(_options: ApiBodyOptions): MethodDecorator {
  return () => {};
}

/**
 * Declares an OpenAPI query parameter for a route handler.
 *
 * @param _options Query parameter options.
 * @returns A method decorator.
 */
export function ApiQuery(_options: ApiQueryOptions): MethodDecorator {
  return () => {};
}

/**
 * Declares an OpenAPI path parameter for a route handler.
 *
 * @param _options Path parameter options.
 * @returns A method decorator.
 */
export function ApiParam(_options: ApiParamOptions): MethodDecorator {
  return () => {};
}
