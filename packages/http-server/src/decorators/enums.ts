import { METADATA_KEY_PREFIX } from './constants';

export enum MetadataKey {
  RestController = `${METADATA_KEY_PREFIX}rc`,
  RouteHandler = `${METADATA_KEY_PREFIX}rh`,
  RouteHandlerParams = `${METADATA_KEY_PREFIX}rhp`,
}
