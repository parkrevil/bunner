import { type ClassMetadata } from '../analyzer';

import type { ImportRegistry } from './import-registry';

export class MetadataGenerator {
  generate(classes: { metadata: ClassMetadata; filePath: string }[], registry: ImportRegistry): string {
    const registryEntries: string[] = [];
    const availableClasses = new Set(classes.map(c => c.metadata.className));
    // For Inheritance resolution, we still risk collisions if names are same.
    // Resolving inheritance strictly is Phase 5 (Future).
    const classMap = new Map<string, ClassMetadata>();
    const classFilePathMap = new Map<string, string>();

    classes.forEach(c => {
      classMap.set(c.metadata.className, c.metadata);
      classFilePathMap.set(c.metadata.className, c.filePath);
    });

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
    const serializeValue = (value: any): string => {
      if (value === null) {
        return 'null';
      }

      if (value === undefined) {
        return 'undefined';
      }

      if (Array.isArray(value)) {
        return `[${value.map(v => serializeValue(v)).join(',')}]`;
      }

      if (typeof value === 'object') {
        if (value.__bunner_ref) {
          if (value.__bunner_import_source) {
            registry.addImport(value.__bunner_ref, value.__bunner_import_source);
          }

          return value.__bunner_ref;
        }

        if (value.__bunner_factory_code) {
          // Output the factory function code directly
          return value.__bunner_factory_code;
        }

        if (value.__bunner_call) {
          if (value.__bunner_import_source) {
            // If the call base (e.g. ScalarModule) needs import
            const root = value.__bunner_call.split('.')[0];

            if (root !== value.__bunner_call) {
              // If it's Dot notation, import the root
              registry.addImport(root, value.__bunner_import_source);
            } else {
              registry.addImport(value.__bunner_call, value.__bunner_import_source);
            }
          }

          const args = (value.args || []).map((a: any) => serializeValue(a)).join(', ');

          return `${value.__bunner_call}(${args})`;
        }

        if (value.__bunner_new) {
          const args = (value.args || []).map((a: any) => serializeValue(a)).join(', ');

          return `new ${value.__bunner_new}(${args})`;
        }

        if (value.__bunner_forward_ref) {
          return `forwardRef(() => ${value.__bunner_forward_ref})`;
        }

        const entries = Object.entries(value).map(([k, v]) => {
          return `${k}: ${serializeValue(v)}`;
        });

        return `{${entries.join(',')}}`;
      }

      return JSON.stringify(value);
    };

    classes.forEach(({ metadata, filePath }) => {
      const alias = registry.getAlias(metadata.className, filePath); // Use Alias
      const resolvedProperties = resolveMetadata(metadata.className);
      const props = resolvedProperties.map(prop => {
        const isClassRef = availableClasses.has(prop.type);
        let typeValue = serializeValue(prop.type);

        if (isClassRef) {
          const filePath = classFilePathMap.get(prop.type);

          if (filePath) {
            const alias = registry.getAlias(prop.type, filePath);

            typeValue = `() => ${alias}`;
          }
        }

        let itemsStr = 'undefined';

        if (prop.items) {
          let itemTypeVal = `'${prop.items.typeName}'`;

          if (availableClasses.has(prop.items.typeName)) {
            const filePath = classFilePathMap.get(prop.items.typeName);

            if (filePath) {
              const alias = registry.getAlias(prop.items.typeName, filePath);

              itemTypeVal = `() => ${alias}`;
            }
          }

          itemsStr = `{ typeName: ${itemTypeVal} }`;
        }

        // Use serializeValue for decorators to handle __bunner_ref
        return `{
          name: '${prop.name}',
          type: ${typeValue},
          isClass: ${isClassRef},
          typeArgs: ${JSON.stringify(prop.typeArgs)},
          decorators: ${serializeValue(prop.decorators)},
          isOptional: ${prop.isOptional},
          isArray: ${prop.isArray},
          isEnum: ${prop.isEnum},
          items: ${itemsStr},
          literals: ${JSON.stringify(prop.literals)}
        }`;
      });
      const serializeMethods = (methods: any[]) => {
        if (!methods || methods.length === 0) {
          return '[]';
        }

        return `[${methods
          .map(m => {
            const params = (m.parameters || [])
              .map((p: any) => {
                let typeVal = serializeValue(p.type);
                // Check if type is a class reference like properties
                // p.type comes as serialized string/ref from AstParser?
                // AstParser stores typeName in __bunner_ref usually for Class types.
                // Try to find the class name from the ref string
                let typeName = p.type;

                if (typeof p.type === 'object' && p.type.__bunner_ref) {
                  typeName = p.type.__bunner_ref;
                }

                if (availableClasses.has(typeName)) {
                  const filePath = classFilePathMap.get(typeName);

                  if (filePath) {
                    const alias = registry.getAlias(typeName, filePath);

                    typeVal = `() => ${alias}`;
                  }
                }

                return `{
                      name: '${p.name}',
                      type: ${typeVal},
                      typeArgs: ${JSON.stringify(p.typeArgs)},
                      decorators: ${serializeValue(p.decorators)},
                      index: ${p.index}
                  }`;
              })
              .join(',');

            return `{
                  name: '${m.name}',
                  decorators: ${serializeValue(m.decorators)},
                  parameters: [${params}]
              }`;
          })
          .join(',')}]`;
      };
      const metaFactoryCall = `_meta(
        '${metadata.className}',
        ${serializeValue(metadata.decorators)},
        ${serializeValue(metadata.constructorParams)},
        ${serializeMethods(metadata.methods)},
        [${props.join(',')}]
      )`;

      registryEntries.push(`  registry.set(${alias}, ${metaFactoryCall});`);
    });

    return `
export function createMetadataRegistry() {
  const registry = new Map();
${registryEntries.join('\n')}
  
  // Strict Immutability
  registry.forEach(v => deepFreeze(v));
  return sealMap(registry);
}
`;
  }
}
