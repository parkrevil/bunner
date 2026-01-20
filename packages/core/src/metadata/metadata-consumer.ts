import { getRuntimeContext } from '../runtime/runtime-context';

export class MetadataConsumer {
  private static cliRegistry = new Map<any, any>();

  static registerCLIMetadata(registry: Map<any, any>) {
    this.cliRegistry = registry;
  }

  static getCombinedMetadata(target: Function) {
    if (this.cliRegistry.size === 0) {
      const runtimeRegistry = getRuntimeContext().metadataRegistry;

      if (runtimeRegistry) {
        this.cliRegistry = runtimeRegistry;
      }
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
