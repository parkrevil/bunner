import { METADATA_KEY_PREFIX } from './constants';

/**
 * Metadata keys for Bunner HTTP server framework
 * @description The metadata keys used by the Bunner HTTP server framework
 */
export enum MetadataKey {
  RestController = `${METADATA_KEY_PREFIX}rc`,
  RouteHandler = `${METADATA_KEY_PREFIX}rh`,
  RouteHandlerParams = `${METADATA_KEY_PREFIX}rhp`,
}
