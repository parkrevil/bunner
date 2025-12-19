import { MetadataKeys } from '../enums';

import type { FieldOptions } from './interfaces';

export function Field(options?: FieldOptions): PropertyDecorator {
  return function (target: any, propertyKey: string | symbol): void {
    if (!target.__bunner_meta) {
      target.__bunner_meta = {};
    }
    if (!target.__bunner_meta[MetadataKeys.Field]) {
      target.__bunner_meta[MetadataKeys.Field] = {};
    }
    target.__bunner_meta[MetadataKeys.Field][propertyKey] = options || {};
  };
}

export function Exclude(): PropertyDecorator {
  return function (target: any, propertyKey: string | symbol): void {
    if (!target.__bunner_meta) {
      target.__bunner_meta = {};
    }
    if (!target.__bunner_meta[MetadataKeys.Exclude]) {
      target.__bunner_meta[MetadataKeys.Exclude] = {};
    }
    target.__bunner_meta[MetadataKeys.Exclude][propertyKey] = true;
  };
}
