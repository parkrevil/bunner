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
    const availableClasses = new Set(classes.map(c => c.metadata.className));

    classes.forEach(({ metadata, filePath }) => {
      // Import the class
      const relativePath = PathResolver.getRelativeImportPath(outputDir + '/dummy.ts', filePath);
      if (!importedClasses.has(metadata.className)) {
        imports.push(`import { ${metadata.className} } from "${relativePath}";`);
        importedClasses.add(metadata.className);
      }

      // Serialize Metadata manually to support Class References
      const props = metadata.properties.map(prop => {
        // Determine if type is a known class (Reference) or Primitive (String)
        const isClassRef = availableClasses.has(prop.type);
        const typeValue = isClassRef ? prop.type : `'${prop.type}'`;

        // Handle Array Items Type Ref
        let itemsStr = 'undefined';
        if (prop.items) {
          const isItemRef = availableClasses.has(prop.items.typeName);
          const itemTypeVal = isItemRef ? prop.items.typeName : `'${prop.items.typeName}'`;
          itemsStr = `{ typeName: ${itemTypeVal} }`;
        }

        return `{
          name: '${prop.name}',
          type: ${typeValue},
          isClass: ${isClassRef},
          typeArgs: ${JSON.stringify(prop.typeArgs)},
          decorators: ${JSON.stringify(prop.decorators)},
          isOptional: ${prop.isOptional},
          isArray: ${prop.isArray},
          isEnum: ${prop.isEnum},
          items: ${itemsStr},
          literals: ${JSON.stringify(prop.literals)}
        }`;
      });

      const serializedMeta = `{
        className: '${metadata.className}',
        decorators: ${JSON.stringify(metadata.decorators)},
        constructorParams: ${JSON.stringify(metadata.constructorParams)},
        methods: ${JSON.stringify(metadata.methods)},
        properties: [${props.join(',')}]
      }`;

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
