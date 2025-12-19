import { MetadataKeys } from '../enums';

export function Serialize(): ClassDecorator {
  return function <T extends Function>(target: T) {
    if (!(target as any).__bunner_meta) {
      (target as any).__bunner_meta = {};
    }
    (target as any).__bunner_meta[MetadataKeys.Serialize] = true;
  };
}

export function Deserialize(): ClassDecorator {
  return function <T extends Function>(target: T) {
    if (!(target as any).__bunner_meta) {
      (target as any).__bunner_meta = {};
    }
    (target as any).__bunner_meta[MetadataKeys.Deserialize] = true;
  };
}
