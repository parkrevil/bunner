import type { ApiOperationOptions } from './interfaces';

/**
 * Declares OpenAPI operation metadata for a route handler.
 *
 * @param _options Operation options.
 * @returns A method decorator.
 */
export function ApiOperation(_options: ApiOperationOptions): MethodDecorator {
  return () => {};
}
