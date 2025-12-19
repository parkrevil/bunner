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
      const serializedMeta = JSON.stringify({
        className: metadata.className,
        decorators: metadata.decorators,
        constructorParams: metadata.constructorParams,
        methods: metadata.methods,
        properties: metadata.properties,
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
