import { type ClassMetadata, ModuleGraph, type ModuleNode } from '../analyzer';

import { ImportRegistry } from './import-registry';
import { InjectorGenerator } from './injector';
import { MetadataGenerator } from './metadata';

export class ManifestGenerator {
  private injectorGen = new InjectorGenerator();

  private metadataGen = new MetadataGenerator();

  generate(graph: ModuleGraph, classes: { metadata: ClassMetadata; filePath: string }[], outputDir: string): string {
    const registry = new ImportRegistry(outputDir);

    // Pre-register all known classes to ensure consistent aliasing
    classes.forEach(c => {
      registry.getAlias(c.metadata.className, c.filePath);
    });

    const injectorCode = this.injectorGen.generate(graph, registry);
    const metadataCode = this.metadataGen.generate(classes, registry);
    const scopedKeysEntries: string[] = [];

    graph.modules.forEach((node: ModuleNode) => {
      node.providers.forEach((_ref, token: string) => {
        const providerDef = graph.classDefinitions.get(token);
        const alias = providerDef ? registry.getAlias(providerDef.metadata.className, providerDef.filePath) : token;

        scopedKeysEntries.push(`  map.set(${alias}, '${node.name}::${token}');`);
        scopedKeysEntries.push(`  map.set('${token}', '${node.name}::${token}');`);
      });
      node.controllers.forEach((ctrlName: string) => {
        // Resolve controller alias
        // We know node has controllers (ClassName). We need their FilePath.
        // We can look up in graph.classMap or iterate fileMap.
        // Assuming ModuleGraph has been populated correctly.
        // Wait, node.controllers is Set<string> (ClassName).
        // Using ClassName to lookup in graph.classMap is risky if duplicate names exist.
        // But ModuleNode doesn't store Controllers as Nodes, just names.
        // We need to resolve them properly.
        // For now, let's look up using graph.resolveToken or similar logic?
        // Or assume the Controller is imported.
        // Let's use graph.classMap.get(ctrlName).

        let alias = ctrlName;
        // Try to find the specific controller node linked to this module
        // But the current structure stores controllers as string names.
        // We should improve ModuleNode to store Metadata or Path for controllers.
        // Fallback: graph.classMap.get(ctrlName).
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

const deepFreeze = (obj: any, visited = new WeakSet()) => {
  if (visited.has(obj)) return obj;
  if (obj && typeof obj === 'object' && !Object.isFrozen(obj)) {
    visited.add(obj);
    Object.freeze(obj);
    Object.getOwnPropertyNames(obj).forEach(prop => deepFreeze(obj[prop], visited));
  }
  return obj;
};

const sealMap = (map: Map<any, any>) => {
  map.set = map.delete = map.clear = () => {
    throw new Error("FATAL: AOT Registry is immutable.");
  };
  Object.freeze(map);
  return map;
};

const _meta = (className: string, decorators: any[], params: any[], methods: any[], props: any[]) => ({
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
  configurable: false, // Strict AOT: No Runtime Mocking
});
export const metadataRegistry = registry;

`;
  }
}
