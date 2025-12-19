import { type ClassMetadata } from '../analyzer/ast-parser';
import { PathResolver } from '../utils/path-resolver';

export class InjectorGenerator {
  /**
   * Generates the dependency injection container factory code.
   *
   * @param classes List of all analyzed classes with metadata and their source file paths.
   * @param outputDir The directory where the generated code will be saved (to calculate relative paths).
   */
  generate(classes: { metadata: ClassMetadata; filePath: string }[], outputDir: string): string {
    const imports: string[] = [];
    const factoryEntries: string[] = [];

    // Helper to keep track of imported identifiers to avoid clashes (naive implementation)
    const importedIdentifiers = new Set<string>();

    classes.forEach(({ metadata, filePath }) => {
      // 1. Generate Import
      const relativePath = PathResolver.getRelativeImportPath(outputDir + '/dummy.ts', filePath);
      if (!importedIdentifiers.has(metadata.className)) {
        imports.push(`import { ${metadata.className} } from "${relativePath}";`);
        importedIdentifiers.add(metadata.className);
      }

      // 2. Generate Factory Entry
      const deps = metadata.constructorParams.map(param => {
        return `c.get(${param.type})`;
      });

      factoryEntries.push(`  container.set(${metadata.className}, (c) => new ${metadata.className}(${deps.join(', ')}));`);
    });

    return `
import { Container } from "@bunner/core";
${imports.join('\n')}

export function createContainer() {
  const container = new Container();
${factoryEntries.join('\n')}
  return container;
}
`;
  }
}
