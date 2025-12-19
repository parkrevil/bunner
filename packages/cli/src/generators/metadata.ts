import { type ClassMetadata } from '../analyzer/ast-parser';
import { PathResolver } from '../utils/path-resolver';

export class MetadataGenerator {
  /**
   * Generates a generic metadata registry.
   * Maps: Class -> Metadata Object (Decorators, Methods, Props)
   */
  generate(classes: { metadata: ClassMetadata; filePath: string }[], outputDir: string): string {
    const imports: string[] = [];
    const registryEntries: string[] = [];
    const importedClasses = new Set<string>();

    classes.forEach(({ metadata, filePath }) => {
      // Import the class
      const relativePath = PathResolver.getRelativeImportPath(outputDir + '/dummy.ts', filePath);
      if (!importedClasses.has(metadata.className)) {
        imports.push(`import { ${metadata.className} } from "${relativePath}";`);
        importedClasses.add(metadata.className);
      }

      // Serialize Metadata
      // We need to verify if args are serializable (JSON).
      // Analyzer currently extracts literals.
      const serializedMeta = JSON.stringify({
        decorators: metadata.decorators,
        constructorParams: metadata.constructorParams,
        // TODO: Add method decorators and property decorators extraction in AST Parser
        // For now, AST parser only does class & ctor params.
        // We need to extend AST parser to capture method metadata for Routes.
      });

      registryEntries.push(`  registry.set(${metadata.className}, ${serializedMeta});`);
    });

    return `
${imports.join('\n')}

export function createMetadataRegistry() {
  const registry = new Map();
${registryEntries.join('\n')}
  return registry;
}
`;
  }
}
