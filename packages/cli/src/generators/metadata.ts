import { type ClassMetadata } from '../analyzer/ast-parser';
import { PathResolver } from '../utils/path-resolver';

export class MetadataGenerator {
  generate(classes: { metadata: ClassMetadata; filePath: string }[], outputDir: string): string {
    const imports: string[] = [];
    const registryEntries: string[] = [];
    const importedClasses = new Set<string>();
    const availableClasses = new Set(classes.map(c => c.metadata.className));

    const classMap = new Map<string, ClassMetadata>();
    classes.forEach(c => classMap.set(c.metadata.className, c.metadata));

    const cloneProps = (props: ClassMetadata['properties']): ClassMetadata['properties'] =>
      props.map(p => ({
        ...p,
        decorators: [...p.decorators],
        items: p.items ? { ...p.items } : undefined,
      }));

    const resolveMetadata = (className: string, visited = new Set<string>()): ClassMetadata['properties'] => {
      if (visited.has(className)) {
        return [];
      }
      visited.add(className);

      const meta = classMap.get(className);
      if (!meta) {
        return [];
      }

      let properties: ClassMetadata['properties'] = cloneProps(meta.properties);

      if (meta.heritage) {
        const h = meta.heritage;
        const parentProps = resolveMetadata(h.typeName, new Set(visited));

        if (h.typeName) {
          if (['Partial', 'Pick', 'Omit', 'Required'].includes(h.typeName) && h.typeArgs && h.typeArgs.length > 0) {
            const baseDtoName = h.typeArgs[0] as string;
            const baseProps = resolveMetadata(baseDtoName, new Set(visited));

            if (h.typeName === 'Partial') {
              baseProps.forEach(p => {
                p.isOptional = true;
                if (!p.decorators.some(d => d.name === 'IsOptional')) {
                  p.decorators.push({ name: 'IsOptional', arguments: [] });
                }
              });
              properties = [...baseProps, ...properties];
            } else if (h.typeName === 'Pick') {
              properties = [...baseProps, ...properties];
            } else if (h.typeName === 'Omit') {
              properties = [...baseProps, ...properties];
            }
          } else {
            const parentMap = new Map(parentProps.map(p => [p.name, p]));
            properties.forEach(p => parentMap.set(p.name, p));
            properties = Array.from(parentMap.values());
          }
        }
      }
      return properties;
    };

    classes.forEach(({ metadata, filePath }) => {
      const relativePath = PathResolver.getRelativeImportPath(outputDir + '/dummy.ts', filePath);
      if (!importedClasses.has(metadata.className)) {
        imports.push(`import { ${metadata.className} } from "${relativePath}";`);
        importedClasses.add(metadata.className);
      }

      const resolvedProperties = resolveMetadata(metadata.className);

      const props = resolvedProperties.map(prop => {
        const isClassRef = availableClasses.has(prop.type);
        const typeValue = isClassRef ? prop.type : `'${prop.type}'`;

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
