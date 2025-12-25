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
        const typeValue = serializeValue(prop.type);
        let itemsStr = 'undefined';

        if (prop.items) {
          // Items typeName also needs serialization if it's a ref??
          // Current ast-parser doesn't convert items.typeName to ref object yet,
          // but we can assume simple string for DTO items for now or strictly speaking we should handle it too.
          // For now let's keep it simple as DTOs are mostly primitives or explicit refs handled by resolveMetadata?
          // Actually resolveMetadata uses strings for DTO resolution.
          // Let's stick to string for items.typeName for now unless it causes issues.
          const isItemRef = availableClasses.has(prop.items.typeName);
          const itemTypeVal = isItemRef ? `'${prop.items.typeName}'` : `'${prop.items.typeName}'`;

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
      const serializedMeta = `{
        className: '${metadata.className}',
        decorators: ${serializeValue(metadata.decorators)},
        constructorParams: ${serializeValue(metadata.constructorParams)},
        methods: ${serializeValue(metadata.methods)},
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
