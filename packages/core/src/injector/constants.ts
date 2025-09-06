/**
 * Reflect Metadata Key
 * @description The key for the reflect-metadata
 */
export const REFLECT_METADATA_KEY = {
  DESIGN_PARAM_TYPES: 'design:paramtypes',
} as const;

/**
 * Metadata Key Prefix
 * @description The prefix for the metadata key
 */
export const METADATA_KEY_PREFIX = 'b:c:';

/**
 * Metadata keys for Bunner core framework
 * @description The metadata keys used by the Bunner core framework
 */
export const METADATA_KEY = {
  MODULE: Symbol(`${METADATA_KEY_PREFIX}m`),
  INJECTABLE: Symbol(`${METADATA_KEY_PREFIX}ia`),
  INJECT: Symbol(`${METADATA_KEY_PREFIX}i`),
} as const;
