/**
 * Metadata key prefix
 * @description The prefix for the metadata keys
 */
export const METADATA_KEY_PREFIX = 'b:hs:';

/**
 * Metadata keys for Bunner HTTP server framework
 * @description The metadata keys used by the Bunner HTTP server framework
 */
export const METADATA_KEY = {
  REST_CONTROLLER: `${METADATA_KEY_PREFIX}rc`,
  ROUTE_HANDLER: `${METADATA_KEY_PREFIX}rh`,
  ROUTE_HANDLER_PARAMS: `${METADATA_KEY_PREFIX}rhp`,
} as const;
