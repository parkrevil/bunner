import { type ClassMetadata, ModuleGraph, type ModuleNode } from '../analyzer';
import { compareCodePoint } from '../common';

import { ImportRegistry } from './import-registry';
import { InjectorGenerator } from './injector';
import { MetadataGenerator } from './metadata';

export class ManifestGenerator {
  private injectorGen = new InjectorGenerator();

  private metadataGen = new MetadataGenerator();

  generate(graph: ModuleGraph, classes: { metadata: ClassMetadata; filePath: string }[], outputDir: string): string {
    const registry = new ImportRegistry(outputDir);
    const sortedClasses = [...classes].sort((a, b) => {
      const nameDiff = compareCodePoint(a.metadata.className, b.metadata.className);

      if (nameDiff !== 0) {
        return nameDiff;
      }

      return compareCodePoint(a.filePath, b.filePath);
    });

    sortedClasses.forEach(c => {
      registry.getAlias(c.metadata.className, c.filePath);
    });

    const injectorCode = this.injectorGen.generate(graph, registry);
    const metadataCode = this.metadataGen.generate(classes, registry);
    const scopedKeysEntries: string[] = [];
    const sortedNodes = Array.from(graph.modules.values()).sort((a, b) => compareCodePoint(a.filePath, b.filePath));

    sortedNodes.forEach((node: ModuleNode) => {
      const providerTokens = Array.from(node.providers.keys()).sort(compareCodePoint);

      providerTokens.forEach((token: string) => {
        const providerDef = graph.classDefinitions.get(token);
        const alias = providerDef ? registry.getAlias(providerDef.metadata.className, providerDef.filePath) : token;

        scopedKeysEntries.push(`  map.set(${alias}, '${node.name}::${token}');`);
        scopedKeysEntries.push(`  map.set('${token}', '${node.name}::${token}');`);
      });

      const controllerNames = Array.from(node.controllers.values()).sort(compareCodePoint);

      controllerNames.forEach((ctrlName: string) => {
        let alias = ctrlName;
        const ctrlDef = graph.classDefinitions.get(ctrlName);

        if (ctrlDef) {
          alias = registry.getAlias(ctrlName, ctrlDef.filePath);
        }

        scopedKeysEntries.push(`  map.set(${alias}, '${node.name}::${ctrlName}');`);
        scopedKeysEntries.push(`  map.set('${ctrlName}', '${node.name}::${ctrlName}');`);
      });
    });

    const imports = registry.getImportStatements().join('\n');

    return `
${imports}

const deepFreeze = (obj: unknown, visited = new WeakSet<object>()): unknown => {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  if (visited.has(obj)) {
    return obj;
  }

  if (!Object.isFrozen(obj)) {
    visited.add(obj);
    Object.freeze(obj);
    Object.getOwnPropertyNames(obj).forEach(prop => {
      const record = obj as Record<string, unknown>;

      deepFreeze(record[prop], visited);
    });
  }

  return obj;
};

const sealMap = <K, V>(map: Map<K, V>): Map<K, V> => {
  (map as unknown as { set: (...args: unknown[]) => unknown }).set = () => {
    throw new Error("FATAL: AOT Registry is immutable.");
  };

  (map as unknown as { delete: (...args: unknown[]) => unknown }).delete = () => {
    throw new Error("FATAL: AOT Registry is immutable.");
  };

  (map as unknown as { clear: (...args: unknown[]) => unknown }).clear = () => {
    throw new Error("FATAL: AOT Registry is immutable.");
  };

  Object.freeze(map);
  return map;
};

const _meta = (
  className: string,
  decorators: readonly unknown[],
  params: readonly unknown[],
  methods: readonly unknown[],
  props: readonly unknown[],
): {
  className: string;
  decorators: readonly unknown[];
  constructorParams: readonly unknown[];
  methods: readonly unknown[];
  properties: readonly unknown[];
} => ({
  className,
  decorators,
  constructorParams: params,
  methods,
  properties: props
});

${injectorCode}

${metadataCode}

export function createScopedKeysMap() {
  const map = new Map();
${scopedKeysEntries.join('\n')}
  return sealMap(map);
}


const registry = createMetadataRegistry();
Object.defineProperty(globalThis, '__BUNNER_METADATA_REGISTRY__', {
  value: registry,
  writable: false,
  configurable: false,
});
export const metadataRegistry = registry;

`;
  }
}
