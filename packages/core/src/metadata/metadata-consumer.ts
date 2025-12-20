import { MetadataStorage } from './metadata-storage';

export class MetadataConsumer {
  private static cliRegistry = new Map<any, any>();

  static registerCLIMetadata(registry: Map<any, any>) {
    this.cliRegistry = registry;
  }

  static getCombinedMetadata(target: Function) {
    // Auto-load from global if not yet registered
    if (this.cliRegistry.size === 0 && (globalThis as any).__BUNNER_METADATA_REGISTRY__) {
      this.cliRegistry = (globalThis as any).__BUNNER_METADATA_REGISTRY__;
    }

    const runtimeMeta = MetadataStorage.getMetadata(target) || { properties: {} };
    const cliMeta = this.cliRegistry.get(target);

    // If no CLI metadata, fallback to runtime only (Dev mode JIT without CLI or tests)
    if (!cliMeta) {
      return this.normalizeRuntimeMeta(runtimeMeta);
    }

    // Merge: CLI metadata is the base (structure), Runtime provides extra decorators
    const mergedProperties: any = {};

    // 1. Process CLI properties
    cliMeta.properties.forEach((cliProp: any) => {
      mergedProperties[cliProp.name] = {
        ...cliProp,
        decorators: [...(cliProp.decorators || [])], // Clone CLI decorators
      };

      // Merge runtime decorators if any
      const runtimeProp = runtimeMeta.properties[cliProp.name];
      if (runtimeProp && runtimeProp.decorators) {
        mergedProperties[cliProp.name].decorators.push(...runtimeProp.decorators);
      }
    });

    // 2. Process purely runtime properties (dynamic or extended) if any?
    // Usually CLI should cover everything static. We skip dynamic for now to be strict.

    return {
      className: cliMeta.className || target.name,
      properties: mergedProperties,
    };
  }

  private static normalizeRuntimeMeta(runtimeMeta: any) {
    // Convert runtime storage format to unified format
    const properties: any = {};
    for (const [key, value] of Object.entries(runtimeMeta.properties)) {
      properties[key] = {
        name: key,
        type: 'any', // Unknown without CLI
        decorators: (value as any).decorators || [],
        isOptional: false, // Cannot know for sure without reflection/CLI
        isArray: false,
      };
    }
    return { properties };
  }
}
