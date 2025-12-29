import { type ClassMetadata } from '../analyzer';
import { compareCodePoint } from '../common';

import type { ImportRegistry } from './import-registry';

export class MetadataGenerator {
  generate(classes: { metadata: ClassMetadata; filePath: string }[], registry: ImportRegistry): string {
    const sortedClasses = [...classes].sort((a, b) => {
      const nameDiff = compareCodePoint(a.metadata.className, b.metadata.className);

      if (nameDiff !== 0) {
        return nameDiff;
      }

      return compareCodePoint(a.filePath, b.filePath);
    });
    const registryEntries: string[] = [];
    const availableClasses = new Set(sortedClasses.map(c => c.metadata.className));
    const classMap = new Map<string, ClassMetadata>();
    const classFilePathMap = new Map<string, string>();

    sortedClasses.forEach(c => {
      classMap.set(c.metadata.className, c.metadata);
      classFilePathMap.set(c.metadata.className, c.filePath);
    });

    const getRefName = (value: unknown): string | null => {
      if (typeof value === 'string') {
        return value;
      }

      if (!value || typeof value !== 'object') {
        return null;
      }

      const record = value as Record<string, unknown>;

      if (typeof record.__bunner_ref === 'string') {
        return record.__bunner_ref;
      }

      return null;
    };
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
    const serializeValue = (value: unknown): string => {
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
        if (!value) {
          return 'null';
        }

        const record = value as Record<string, unknown>;

        if (typeof record.__bunner_ref === 'string') {
          if (typeof record.__bunner_import_source === 'string') {
            registry.addImport(record.__bunner_ref, record.__bunner_import_source);
          }

          return record.__bunner_ref;
        }

        if (typeof record.__bunner_factory_code === 'string') {
          return record.__bunner_factory_code;
        }

        if (typeof record.__bunner_call === 'string') {
          if (typeof record.__bunner_import_source === 'string') {
            const root = record.__bunner_call.split('.')[0];

            if (!root) {
              return record.__bunner_call;
            }

            if (root !== record.__bunner_call) {
              registry.addImport(root, record.__bunner_import_source);
            } else {
              registry.addImport(record.__bunner_call, record.__bunner_import_source);
            }
          }

          const args = (Array.isArray(record.args) ? record.args : []).map(a => serializeValue(a)).join(', ');

          return `${record.__bunner_call}(${args})`;
        }

        if (typeof record.__bunner_new === 'string') {
          const args = (Array.isArray(record.args) ? record.args : []).map(a => serializeValue(a)).join(', ');

          return `new ${record.__bunner_new}(${args})`;
        }

        if (typeof record.__bunner_forward_ref === 'string') {
          return `forwardRef(() => ${record.__bunner_forward_ref})`;
        }

        const entries = Object.entries(record).map(([k, v]) => {
          return `${k}: ${serializeValue(v)}`;
        });

        return `{${entries.join(',')}}`;
      }

      return JSON.stringify(value);
    };

    sortedClasses.forEach(({ metadata, filePath }) => {
      const alias = registry.getAlias(metadata.className, filePath);
      const resolvedProperties = resolveMetadata(metadata.className);
      const props = resolvedProperties.map(prop => {
        const propTypeName = getRefName(prop.type);
        const isClassRef = !!propTypeName && availableClasses.has(propTypeName);
        let typeValue = serializeValue(prop.type);

        if (isClassRef) {
          const filePath = propTypeName ? classFilePathMap.get(propTypeName) : undefined;

          if (filePath) {
            const alias = propTypeName ? registry.getAlias(propTypeName, filePath) : undefined;

            if (alias) {
              typeValue = `() => ${alias}`;
            }
          }
        }

        let itemsStr = 'undefined';

        if (prop.items) {
          const itemRecord = prop.items as Record<string, unknown>;
          const itemTypeName = typeof itemRecord.typeName === 'string' ? itemRecord.typeName : 'Unknown';
          let itemTypeVal = `'${itemTypeName}'`;

          if (availableClasses.has(itemTypeName)) {
            const filePath = classFilePathMap.get(itemTypeName);

            if (filePath) {
              const alias = registry.getAlias(itemTypeName, filePath);

              itemTypeVal = `() => ${alias}`;
            }
          }

          itemsStr = `{ typeName: ${itemTypeVal} }`;
        }

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
      const serializeMethods = (methods: ClassMetadata['methods']): string => {
        if (!methods || methods.length === 0) {
          return '[]';
        }

        return `[${methods
          .map(m => {
            const params = (m.parameters || [])
              .map(p => {
                let typeVal = serializeValue(p.type);
                const typeName = getRefName(p.type);

                if (typeName && availableClasses.has(typeName)) {
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
  
  registry.forEach(v => deepFreeze(v));
  return sealMap(registry);
}
`;
  }
}
