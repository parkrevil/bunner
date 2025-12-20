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

    // Generate Scoped Keys Map
    // We need to map Class Constructor -> Scoped Token (e.g. 'Module::Class')
    // This is primarily for Controllers so RouteHandler can find them.
    const scopedKeysEntries: string[] = [];

    graph.modules.forEach((node: ModuleNode) => {
      node.controllers.forEach((ctrlName: string) => {
        // We assume ctrlName is the class name.
        // We need to import the class to use it as a key.
        // InjectorGenerator already imports them? No, we need explicit imports here or reuse.
        // Actually InjectorGenerator imports are local to that function scope usually?
        // Wait, InjectorGenerator generates the whole file content including imports?
        // Yes, it returns a string with imports.

        // We should coordinate imports.
        // For now, let's just make InjectorGenerator generate the map too?
        // Or easier: ManifestGenerator generates the map but assumes InjectorGenerator's imports are available?
        // InjectorGenerator generates the WHOLE `createContainer` function AND imports.

        scopedKeysEntries.push(`  map.set(${ctrlName}, '${node.name}::${ctrlName}');`);
      });
    });

    return `
// @bunner/generated
// This file is auto-generated. Do not edit.

${injectorCode}

${metadataCode}



export function createScopedKeysMap() {
  const map = new Map();
${scopedKeysEntries.join('\n')}
  return map;
}
`;
  }
}
