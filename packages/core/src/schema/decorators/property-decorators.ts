import { MetadataKeys } from '../enums';

import type { FieldOptions } from './interfaces';

export function Field(options?: FieldOptions): PropertyDecorator {
  return function (target: object, propertyKey: string | symbol): void {
    Reflect.defineMetadata(MetadataKeys.Field, options, target, propertyKey);
  };
}

export function Exclude(): PropertyDecorator {
  return function (target: object, propertyKey: string | symbol): void {
    Reflect.defineMetadata(MetadataKeys.Exclude, true, target, propertyKey);
  };
}
