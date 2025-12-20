import { MetadataStorage } from '../metadata/metadata-storage';

export function Hidden() {
  return function (_: undefined, context: ClassFieldDecoratorContext) {
    if (context.kind !== 'field') {
      throw new Error(`@Hidden must be used on a field. Used on: ${context.kind}`);
    }
    MetadataStorage.addDecoratorMetadata(context, {
      name: 'Hidden',
      arguments: [],
    });
  };
}

export function Transform(transformFn: (params: { value: any; key: string; obj: any; type: any }) => any) {
  return function (_: undefined, context: ClassFieldDecoratorContext) {
    if (context.kind !== 'field') {
      throw new Error(`@Transform must be used on a field. Used on: ${context.kind}`);
    }
    MetadataStorage.addDecoratorMetadata(context, {
      name: 'Transform',
      arguments: [transformFn], // This is a runtime function reference
    });
  };
}
