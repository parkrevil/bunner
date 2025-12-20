// Simple global storage since we don't want to use 'reflect-metadata' package at runtime
// Key: Class Constructor, Value: Metadata Object
const storage = new WeakMap<object, any>();

export class MetadataStorage {
  static addDecoratorMetadata(target: object, propertyKey: string | symbol | undefined, metadata: any) {
    // Resolve the class constructor to use as the WeakMap key
    let constructor: any = target;

    if (propertyKey) {
      // It's a property or method decorator
      if (typeof target === 'object' && target !== null) {
        // Instance member: target is the Prototype
        constructor = target.constructor;
      }
      // If target is a function, it's a Static member (target IS the constructor)
    }
    // If propertyKey is undefined, it's a Class decorator (target IS the constructor)

    let meta = storage.get(constructor);
    if (!meta) {
      meta = { properties: {} };
      storage.set(constructor, meta);
    }

    // For Class Decorators, use a special key or just root?
    // Let's use a special key 'class' or attach to properties with a prefix?
    // Current CLI might expect them in specific place.
    // CLI AstParser extracts them to top-level 'decorators' array.
    // MetadataStorage runtime structure: meta.properties[propKey].decorators

    // Let's store class decorators under a special property key like "__class__"
    const propKey = propertyKey ? String(propertyKey) : '__class__';

    if (!meta.properties[propKey]) {
      meta.properties[propKey] = { decorators: [] };
    }

    meta.properties[propKey].decorators.push(metadata);
  }

  static getMetadata(target: Function) {
    return storage.get(target);
  }
}
