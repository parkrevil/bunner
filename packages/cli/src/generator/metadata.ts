import { type ClassMetadata } from '../analyzer';

import type { ImportRegistry } from './import-registry';

export class MetadataGenerator {
  generate(classes: { metadata: ClassMetadata; filePath: string }[], registry: ImportRegistry): string {
    const registryEntries: string[] = [];
    const availableClasses = new Set(classes.map(c => c.metadata.className));

    // For Inheritance resolution, we still risk collisions if names are same.
    // Resolving inheritance strictly is Phase 5 (Future).
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
      const alias = registry.getAlias(metadata.className, filePath); // Use Alias

      const resolvedProperties = resolveMetadata(metadata.className);

      const props = resolvedProperties.map(prop => {
        const isClassRef = availableClasses.has(prop.type);
        // We use string name for type reference in metadata for now.
        // It doesn't use the usage alias (e.g. UserModule_1).
        // Runtime metadata usually stores constructors if possible, or strings.
        // If string, collisions happen.
        // Ideally we should output `type: () => Alias` (Lazy function)
        // For CLI metadata, we just output string literal or boolean.
        const typeValue = isClassRef ? `'${prop.type}'` : `'${prop.type}'`; // Always string for safety now?
        // Original: const typeValue = isClassRef ? prop.type : `'${prop.type}'`;
        // If we output `UserModule`, it refers to the imported Alias.
        // If we aliased `UserModule` to `UserModule_1`, we must output `UserModule_1`.

        // However, `prop.type` is just a string name from AST.
        // We don't know WHICH `UserModule` (from /a or /b) it refers to without strict AST resolution.
        // This confirms Heritage/Type Reference is weak.
        // We keep it as is (Best Effort).

        let finalTypeVal = typeValue;
        if (isClassRef) {
          // Try to find if we have an alias?
          // We can't know which file it points to easily.
          // We'll trust global uniqueness or let it reference the name (might be wrong reference if shadowed).
          // Safe bet: Output String Name.
          finalTypeVal = `'${prop.type}'`;
        }

        let itemsStr = 'undefined';
        if (prop.items) {
          const isItemRef = availableClasses.has(prop.items.typeName);
          const itemTypeVal = isItemRef ? `'${prop.items.typeName}'` : `'${prop.items.typeName}'`;
          itemsStr = `{ typeName: ${itemTypeVal} }`;
        }

        return `{
          name: '${prop.name}',
          type: ${finalTypeVal},
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

      registryEntries.push(`  registry.set(${alias}, ${serializedMeta});`);
    });

    return `
export function createMetadataRegistry() {
  const registry = new Map();
${registryEntries.join('\n')}
  return registry;
}
`;
  }
}
