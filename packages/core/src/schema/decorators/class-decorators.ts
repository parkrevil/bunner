import { MetadataKeys } from '../enums';

export function Serialize(): ClassDecorator {
  return function <T extends Function>(target: T) {
    Reflect.defineMetadata(MetadataKeys.Serialize, true, target);
  };
}

export function Deserialize(): ClassDecorator {
  return function <T extends Function>(target: T) {
    Reflect.defineMetadata(MetadataKeys.Deserialize, true, target);
  };
}
