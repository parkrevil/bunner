import { METADATA_KEY_PREFIX } from './constants';

/**
 * Reflect Metadata Key
 * @description The key for the reflect-metadata
 */
export enum ReflectMetadataKey {
  DesignParamTypes = 'design:paramtypes',
}

/**
 * Metadata keys for Bunner core framework
 * @description The metadata keys used by the Bunner core framework
 */
export enum MetadataKey {
  RootModule = `${METADATA_KEY_PREFIX}rm`,
  Module = `${METADATA_KEY_PREFIX}m`,
  Injectable = `${METADATA_KEY_PREFIX}ia`,
  Inject = `${METADATA_KEY_PREFIX}i`,
}
