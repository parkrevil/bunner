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
export function ApiBody(_options: { type: unknown; description?: string; isArray?: boolean }): MethodDecorator {
  return () => {};
}

/**
 * Declares an OpenAPI query parameter for a route handler.
 *
 * @param _options Query parameter options.
 * @returns A method decorator.
 */
export function ApiQuery(_options: { name: string; required?: boolean; type?: unknown; description?: string }): MethodDecorator {
  return () => {};
}

/**
 * Declares an OpenAPI path parameter for a route handler.
 *
 * @param _options Path parameter options.
 * @returns A method decorator.
 */
export function ApiParam(_options: { name: string; type?: unknown; description?: string }): MethodDecorator {
  return () => {};
}
