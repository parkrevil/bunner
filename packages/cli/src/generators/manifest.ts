import { type ClassMetadata } from '../analyzer/ast-parser';
import { ModuleGraph, type ModuleNode } from '../analyzer/graph/module-graph';

import { InjectorGenerator } from './injector';
import { MetadataGenerator } from './metadata';

export class ManifestGenerator {
  private injectorGen = new InjectorGenerator();

  private metadataGen = new MetadataGenerator();

  generate(graph: ModuleGraph, classes: { metadata: ClassMetadata; filePath: string }[], outputDir: string): string {
    const injectorCode = this.injectorGen.generate(graph, outputDir);
    const metadataCode = this.metadataGen.generate(classes, outputDir);

    const scopedKeysEntries: string[] = [];

    graph.modules.forEach((node: ModuleNode) => {
      node.controllers.forEach((ctrlName: string) => {
        scopedKeysEntries.push(`  map.set(${ctrlName}, '${node.name}::${ctrlName}');`);
      });
    });

    return `

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
