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
        const providerNode = graph.classMap.get(token);
        const alias = providerNode ? registry.getAlias(providerNode.metadata.className, providerNode.filePath) : token;

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
        const ctrlNode = graph.classMap.get(ctrlName);

        if (ctrlNode) {
          alias = registry.getAlias(ctrlName, ctrlNode.filePath);
        }

        scopedKeysEntries.push(`  map.set(${alias}, '${node.name}::${ctrlName}');`);
        scopedKeysEntries.push(`  map.set('${ctrlName}', '${node.name}::${ctrlName}');`);
      });
    });

    const imports = registry.getImportStatements().join('\n');

    return `
${imports}

${injectorCode}

${metadataCode}

export function createScopedKeysMap() {
  const map = new Map();
${scopedKeysEntries.join('\n')}
  return map;
}


const registry = createMetadataRegistry();
(globalThis as any).__BUNNER_METADATA_REGISTRY__ = registry;
export const metadataRegistry = registry;

`;
  }
}
