// Polyfill Symbol.metadata if not exists (Bun/Node > 20 might have it, but strict safety)
(Symbol as any).metadata ??= Symbol('Symbol.metadata');

export const BUNNER_METADATA = Symbol('BUNNER_METADATA');

export class MetadataStorage {
  static addDecoratorMetadata(
    context: ClassFieldDecoratorContext | ClassMethodDecoratorContext | ClassDecoratorContext,
    metadata: any,
  ) {
    const metaObj = (context.metadata as any)[BUNNER_METADATA] || { properties: {} }; // For methods, we might want "methods" key?
    // Current Structure: { properties: {} } - "properties" is generic for members.
    (context.metadata as any)[BUNNER_METADATA] = metaObj;

    const propKey = String(context.name);
    // TODO: Distinguish between methods and properties if needed.
    // For now, validator uses checks on usage.

    if (!metaObj.properties[propKey]) {
      metaObj.properties[propKey] = { decorators: [] };
    }

    metaObj.properties[propKey].decorators.push(metadata);
  }

  static getMetadata(target: Function) {
    // Read from Symbol.metadata
    const meta = (target as any)[Symbol.metadata];
    return meta ? meta[BUNNER_METADATA] : undefined;
  }

  // Backward compatibility mock for "get()" singleton if needed?
  // No, let's switch to static utils.
}
