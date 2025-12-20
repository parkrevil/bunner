export class MetadataConsumer {
  private static cliRegistry = new Map<any, any>();

  static registerCLIMetadata(registry: Map<any, any>) {
    this.cliRegistry = registry;
  }

  static getCombinedMetadata(target: Function) {
    if (this.cliRegistry.size === 0 && (globalThis as any).__BUNNER_METADATA_REGISTRY__) {
      this.cliRegistry = (globalThis as any).__BUNNER_METADATA_REGISTRY__;
    }

    const cliMeta = this.cliRegistry.get(target);

    if (!cliMeta) {
      return { className: target.name, properties: {} };
    }

    const properties: Record<string, any> = {};
    if (Array.isArray(cliMeta.properties)) {
      cliMeta.properties.forEach((prop: any) => {
        properties[prop.name] = prop;
      });
    } else {
      Object.assign(properties, cliMeta.properties);
    }

    return {
      className: cliMeta.className || target.name,
      properties: properties,
      decorators: cliMeta.decorators,
      constructorParams: cliMeta.constructorParams,
      methods: cliMeta.methods,
    };
  }
}
