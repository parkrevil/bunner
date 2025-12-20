import { MetadataStorage } from '../../metadata/metadata-storage';

import type { FieldOptions } from './interfaces';

export function Field(options?: FieldOptions) {
  return function (_: undefined, context: ClassFieldDecoratorContext) {
    if (context.kind !== 'field') {
      throw new Error(`@Field must be used on a field. Used on: ${context.kind}`);
    }

    MetadataStorage.addDecoratorMetadata(context, {
      name: 'Field',
      arguments: [],
      options,
    });
  };
}

export function Exclude() {
  return function (_: undefined, context: ClassFieldDecoratorContext) {
    if (context.kind !== 'field') {
      throw new Error(`@Exclude must be used on a field. Used on: ${context.kind}`);
    }

    MetadataStorage.addDecoratorMetadata(context, {
      name: 'Exclude', // We keep Exclude name for Schema, but runtime should map it to Hidden or handle it.
      arguments: [],
    });
  };
}
