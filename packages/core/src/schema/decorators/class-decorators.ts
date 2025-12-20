import { MetadataStorage } from '../../metadata/metadata-storage';
// MetadataKeys unused

export function Serialize() {
  return function (_: any, context: ClassDecoratorContext) {
    if (context.kind !== 'class') {
      throw new Error(`@Serialize must be used on a class. Used on: ${context.kind}`);
    }

    MetadataStorage.addDecoratorMetadata(context, {
      name: 'Serialize',
      arguments: [],
    });

    // Legacy support if needed via explicit meta attach?
    // JIT compiler should read from MetadataStorage.
  };
}

export function Deserialize() {
  return function (_: any, context: ClassDecoratorContext) {
    if (context.kind !== 'class') {
      throw new Error(`@Deserialize must be used on a class. Used on: ${context.kind}`);
    }

    MetadataStorage.addDecoratorMetadata(context, {
      name: 'Deserialize',
      arguments: [],
    });
  };
}
