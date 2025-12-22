import { METADATA_KEY_PREFIX } from './constants';

export enum ReflectMetadataKey {
  DesignParamTypes = 'design:paramtypes',
}

export enum MetadataKey {
  Module = `${METADATA_KEY_PREFIX}m`,
  Injectable = `${METADATA_KEY_PREFIX}ia`,
  Inject = `${METADATA_KEY_PREFIX}i`,
}
