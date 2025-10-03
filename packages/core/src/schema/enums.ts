import { METADATA_KEY_PREFIX } from './constants';

export enum MetadataKeys {
  Serialize = `${METADATA_KEY_PREFIX}:s`,
  Deserialize = `${METADATA_KEY_PREFIX}:ds`,
  Field = `${METADATA_KEY_PREFIX}:f`,
  Exclude = `${METADATA_KEY_PREFIX}:e`,
}
