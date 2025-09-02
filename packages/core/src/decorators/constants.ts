/**
 * Reflect Metadata Key
 * @description The key for the reflect-metadata
 */
export const ReflectMetadataKey = {
  DesignParamtypes: 'design:paramtypes',
} as const;

/**
 * Metadata Key Prefix
 * @description The prefix for the metadata key
 */
export const MetadataKeyPrefix = 'bunner:core:';

/**
 * Metadata keys for Bunner core framework
 * @description The metadata keys used by the Bunner core framework
 */
export const MetadataKey = {
  Module: Symbol(`${MetadataKeyPrefix}module`),
  Injectable: Symbol(`${MetadataKeyPrefix}injectable`),
  Inject: Symbol(`${MetadataKeyPrefix}inject`),
} as const;
