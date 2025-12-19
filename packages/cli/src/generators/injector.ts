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
      // TODO: Handle name collisions (e.g. User from auth vs User from core)
      // For now, assume unique class names or simple matching.
      const relativePath = PathResolver.getRelativeImportPath(outputDir + '/dummy.ts', filePath);
      imports.push(`import { ${metadata.className} } from "${relativePath}";`);
      importedIdentifiers.add(metadata.className);

      // 2. Generate Factory Entry
      // Key: The Identifier Reference (Class)
      // Value: Factory Function
      // (c) => new UserService(c.get(DatabaseService))

      const deps = metadata.constructorParams.map(param => {
        // We assume the type name is the token.
        // We need to ensure referenced types are also imported, OR we use string tokens if we can't find them?
        // For a loose AOT, if we use Class as token, we must import it.
        // If the param type is explicitly imported in the source file, we might be able to resolve it.
        // But here we only have the simple name "DatabaseService".
        // If "DatabaseService" is also in the 'classes' list, we can import it (it's already handled above).
        // If it's a 3rd party class, we might miss it.
        // Strategy: For now, we assume all providers are in the project and unique.
        return `c.get(${param.type})`;
      });

      factoryEntries.push(`  container.set(${metadata.className}, (c) => new ${metadata.className}(${deps.join(', ')}));`);
    });

    return `
${imports.join('\n')}

export function createContainer() {
  const container = new Map();
${factoryEntries.join('\n')}
  return container;
}
`;
  }
}
