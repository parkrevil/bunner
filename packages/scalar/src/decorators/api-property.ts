import type { ApiPropertyOptions } from './interfaces';

/**
 * Declares OpenAPI schema metadata for a DTO property.
 *
 * @param _options Property options.
 * @returns A property decorator.
 */
export function ApiProperty(_options?: ApiPropertyOptions): PropertyDecorator {
  return () => {};
}

/**
 * Declares OpenAPI schema metadata for an optional DTO property.
 *
 * @param _options Property options.
 * @returns A property decorator.
 */
export function ApiPropertyOptional(_options?: ApiPropertyOptions): PropertyDecorator {
  return () => {};
}
