/**
 * Metadata key prefix
 * @description The prefix for the metadata keys
 */
export const MetadataKeyPrefix = 'bunner:http-server:';

/**
 * Metadata keys for Bunner HTTP server framework
 * @description The metadata keys used by the Bunner HTTP server framework
 */
export const MetadataKey = {
  Controller: `${MetadataKeyPrefix}controller`,
  RouteHandler: `${MetadataKeyPrefix}route-handler`,
  RouteHandlerParam: `${MetadataKeyPrefix}route-handler-param`,
} as const;
