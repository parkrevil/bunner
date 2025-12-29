import { type ClassMetadata, ModuleGraph, type ModuleNode } from '../analyzer';
import { compareCodePoint } from '../common';

import type { ImportRegistry } from './import-registry';

type RecordUnknown = Record<string, unknown>;

const stableKey = (value: unknown, visited = new WeakSet<object>()): string => {
  if (value === null) {
    return 'null';
  }

  if (value === undefined) {
    return 'undefined';
  }

  if (typeof value === 'string') {
    return `string:${value}`;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return `${typeof value}:${String(value)}`;
  }

  if (typeof value === 'symbol') {
    return `symbol:${value.description ?? value.toString()}`;
  }

  if (typeof value === 'function') {
    return `function:${value.name}`;
  }

  if (Array.isArray(value)) {
    const parts = value.map(v => stableKey(v, visited));

    return `[${parts.join(',')}]`;
  }

  if (typeof value !== 'object' || !value) {
    return 'unknown';
  }

  if (visited.has(value)) {
    return '[Circular]';
  }

  visited.add(value);

  const record = value as Record<string, unknown>;
  const entries = Object.entries(record).sort(([a], [b]) => compareCodePoint(a, b));
  const parts = entries.map(([k, v]) => `${k}:${stableKey(v, visited)}`);

  return `{${parts.join(',')}}`;
};
const asString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  return value;
};
const asRecord = (value: unknown): RecordUnknown | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  return value as RecordUnknown;
};
const getRefName = (value: unknown): string | null => {
  if (typeof value === 'string') {
    return value;
  }

  const record = asRecord(value);

  if (!record) {
    return null;
  }

  if (typeof record.__bunner_ref === 'string') {
    return record.__bunner_ref;
  }

  return null;
};
const getForwardRefName = (value: unknown): string | null => {
  const record = asRecord(value);

  if (!record) {
    return null;
  }

  if (typeof record.__bunner_forward_ref === 'string') {
    return record.__bunner_forward_ref;
  }

  return null;
};
const isClassMetadata = (value: unknown): value is ClassMetadata => {
  const record = asRecord(value);

  if (!record) {
    return false;
  }

  if (typeof record.className !== 'string') {
    return false;
  }

  if (!Array.isArray(record.constructorParams)) {
    return false;
  }

  if (!Array.isArray(record.decorators)) {
    return false;
  }

  if (!Array.isArray(record.methods)) {
    return false;
  }

  if (!Array.isArray(record.properties)) {
    return false;
  }

  if (!record.imports || typeof record.imports !== 'object') {
    return false;
  }

  return true;
};

export class InjectorGenerator {
  generate(graph: ModuleGraph, registry: ImportRegistry): string {
    const factoryEntries: string[] = [];
    const adapterConfigs: string[] = [];
    const getAlias = (name: string, path?: string): string => {
      if (!path) {
        return name;
      }

      return registry.getAlias(name, path);
    };
    const sortedNodes = Array.from(graph.modules.values()).sort((a, b) => compareCodePoint(a.filePath, b.filePath));

    sortedNodes.forEach((node: ModuleNode) => {
      const providerTokens = Array.from(node.providers.keys()).sort(compareCodePoint);

      providerTokens.forEach((token: string) => {
        const ref = node.providers.get(token);

        if (!ref) {
          return;
        }

        const providerRecord = asRecord(ref.metadata);

        if (providerRecord) {
          if (Object.prototype.hasOwnProperty.call(providerRecord, 'useValue')) {
            const val = this.serializeValue(providerRecord.useValue, registry);

            factoryEntries.push(`  container.set('${node.name}::${token}', () => ${val});`);

            return;
          }

          if (providerRecord.useClass !== undefined) {
            const useClass = providerRecord.useClass;
            const classes = Array.isArray(useClass) ? useClass : [useClass];
            const instances = classes.map((clsItem: unknown) => {
              const className = getRefName(clsItem);

              if (!className) {
                return 'undefined';
              }

              const clsDef = graph.classDefinitions.get(className);

              if (!clsDef) {
                return 'undefined';
              }

              const alias = getAlias(clsDef.metadata.className, clsDef.filePath);
              const deps = this.resolveConstructorDeps(clsDef.metadata, node, graph);

              return `new ${alias}(${deps.join(', ')})`;
            });
            const factoryBody = Array.isArray(useClass) ? `[${instances.join(', ')}]` : instances[0];

            factoryEntries.push(`  container.set('${node.name}::${token}', (c) => ${factoryBody});`);

            return;
          }

          if (providerRecord.useExisting !== undefined) {
            const existingToken = this.serializeValue(providerRecord.useExisting, registry);

            factoryEntries.push(`  container.set('${node.name}::${token}', (c) => c.get(${existingToken}));`);

            return;
          }

          if (providerRecord.useFactory !== undefined) {
            const factoryRecord = asRecord(providerRecord.useFactory);
            let factoryFn = typeof factoryRecord?.__bunner_factory_code === 'string' ? factoryRecord.__bunner_factory_code : '';
            const deps = Array.isArray(factoryRecord?.__bunner_factory_deps) ? factoryRecord.__bunner_factory_deps : [];

            if (!factoryFn) {
              return;
            }

            const replacements: Array<{ start: number; end: number; content: string }> = [];
            const orderedDeps = [...deps].sort((a, b) => {
              const left = asRecord(a);
              const right = asRecord(b);
              const leftName = typeof left?.name === 'string' ? left.name : '';
              const rightName = typeof right?.name === 'string' ? right.name : '';
              const nameDiff = compareCodePoint(leftName, rightName);

              if (nameDiff !== 0) {
                return nameDiff;
              }

              const leftPath = typeof left?.path === 'string' ? left.path : '';
              const rightPath = typeof right?.path === 'string' ? right.path : '';
              const pathDiff = compareCodePoint(leftPath, rightPath);

              if (pathDiff !== 0) {
                return pathDiff;
              }

              const leftStart = typeof left?.start === 'number' ? left.start : 0;
              const rightStart = typeof right?.start === 'number' ? right.start : 0;
              const startDiff = leftStart - rightStart;

              if (startDiff !== 0) {
                return startDiff;
              }

              const leftEnd = typeof left?.end === 'number' ? left.end : 0;
              const rightEnd = typeof right?.end === 'number' ? right.end : 0;

              return leftEnd - rightEnd;
            });

            orderedDeps.forEach((dep: unknown) => {
              const depRecord = asRecord(dep);

              if (!depRecord) {
                return;
              }

              const name = typeof depRecord.name === 'string' ? depRecord.name : null;
              const path = typeof depRecord.path === 'string' ? depRecord.path : null;
              const start = typeof depRecord.start === 'number' ? depRecord.start : null;
              const end = typeof depRecord.end === 'number' ? depRecord.end : null;

              if (!name || !path || start === null || end === null) {
                return;
              }

              const alias = registry.getAlias(name, path);

              if (alias !== name) {
                replacements.push({ start, end, content: alias });
              }
            });
            replacements
              .sort((a, b) => b.start - a.start)
              .forEach(rep => {
                factoryFn = factoryFn.slice(0, rep.start) + rep.content + factoryFn.slice(rep.end);
              });

            const injectList = Array.isArray(providerRecord.inject) ? providerRecord.inject : [];
            const injectedArgs = injectList.map((injectItem: unknown) => {
              const tokenName = getRefName(injectItem);

              if (!tokenName) {
                return 'undefined';
              }

              const resolved = graph.resolveToken(node.name, tokenName) || tokenName;

              return `c.get('${resolved}')`;
            });

            factoryEntries.push(`  container.set('${node.name}::${token}', (c) => {`);
            factoryEntries.push(`    const factory = ${factoryFn};`);
            factoryEntries.push(`    return factory(${injectedArgs.join(', ')});`);
            factoryEntries.push('  });');

            return;
          }
        }

        if (isClassMetadata(ref.metadata)) {
          const clsMeta = ref.metadata;
          const alias = getAlias(clsMeta.className, ref.filePath);
          const deps = this.resolveConstructorDeps(clsMeta, node, graph);

          factoryEntries.push(`  container.set('${node.name}::${token}', (c) => new ${alias}(${deps.join(', ')}));`);
        }
      });

      const dynamicBundles = Array.from(node.dynamicProviderBundles).sort((a, b) => compareCodePoint(stableKey(a), stableKey(b)));

      dynamicBundles.forEach(bundle => {
        const stable = this.serializeValue(bundle, registry);

        factoryEntries.push(`  (${stable} || []).forEach(p => {`);
        factoryEntries.push('    let token = p.provide;');
        factoryEntries.push("    if (typeof p === 'function') token = p.name;");
        factoryEntries.push('');
        factoryEntries.push('    let factory;');
        factoryEntries.push("    if (Object.prototype.hasOwnProperty.call(p, 'useValue')) factory = () => p.useValue;");
        factoryEntries.push('    else if (p.useClass) factory = () => new p.useClass();');
        factoryEntries.push('    else if (p.useFactory) {');
        factoryEntries.push('      factory = (c) => {');
        factoryEntries.push('        const args = (p.inject || []).map(t => c.get(t));');
        factoryEntries.push('        return p.useFactory(...args);');
        factoryEntries.push('      };');
        factoryEntries.push('    }');
        factoryEntries.push('');
        factoryEntries.push(
          `    const key = token ? '${node.name}::' + (typeof token === 'symbol' ? token.description : token) : null;`,
        );
        factoryEntries.push('    if (key && factory) container.set(key, factory);');
        factoryEntries.push('  });');
      });

      if (node.moduleDefinition && node.moduleDefinition.adapters) {
        const config = this.serializeValue(node.moduleDefinition.adapters, registry);

        adapterConfigs.push(`  '${node.name}': ${config},`);
      }
    });

    const dynamicEntries: string[] = [];

    sortedNodes.forEach((node: ModuleNode) => {
      const dynamicImports = Array.from(node.dynamicImports).sort((a, b) => compareCodePoint(stableKey(a), stableKey(b)));

      dynamicImports.forEach(imp => {
        const impRecord = asRecord(imp);

        if (!impRecord || typeof impRecord.__bunner_call !== 'string') {
          return;
        }

        const parts = impRecord.__bunner_call.split('.');
        const className = parts[0];
        const methodName = parts[1];

        if (!className) {
          return;
        }

        let callExpression = impRecord.__bunner_call;
        const importSource = asString(impRecord.__bunner_import_source);

        if (importSource === undefined) {
          return;
        }

        {
          const alias = registry.getAlias(className, importSource);

          if (methodName) {
            callExpression = `${alias}.${methodName}`;
          } else {
            callExpression = alias;
          }
        }

        const argList = Array.isArray(impRecord.args) ? impRecord.args : [];
        const args = argList.map(a => this.serializeValue(a, registry)).join(', ');

        dynamicEntries.push(`  const mod_${node.name}_${className} = await ${callExpression}(${args});`);
        dynamicEntries.push(`  await container.loadDynamicModule('${className}', mod_${node.name}_${className});`);
      });
    });

    return `
import { Container } from "@bunner/core";

export function createContainer() {
  const container = new Container();
${factoryEntries.join('\n')}
  return container;
}

export const adapterConfig = deepFreeze({
${adapterConfigs.join('\n')}
});

export async function registerDynamicModules(container: { loadDynamicModule: (name: string, module: unknown) => Promise<void> }) {
${dynamicEntries.join('\n')}
}
`;
  }

  private serializeValue(value: unknown, registry: ImportRegistry): string {
    if (value === undefined) {
      return 'undefined';
    }

    if (value === null) {
      return 'null';
    }

    if (typeof value === 'string') {
      return JSON.stringify(value);
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }

    if (Array.isArray(value)) {
      return `[${value.map(v => this.serializeValue(v, registry)).join(', ')}]`;
    }

    const record = asRecord(value);

    if (!record) {
      return 'undefined';
    }

    if (typeof record.__bunner_ref === 'string' && typeof record.__bunner_import_source === 'string') {
      return registry.getAlias(record.__bunner_ref, record.__bunner_import_source);
    }

    if (typeof record.__bunner_call === 'string') {
      const parts = record.__bunner_call.split('.');
      const className = parts[0];
      const methodName = parts[1];

      if (!className) {
        return 'undefined';
      }

      let callName = record.__bunner_call;
      const importSource = asString(record.__bunner_import_source);

      if (importSource !== undefined) {
        const alias = registry.getAlias(className, importSource);

        if (methodName) {
          callName = `${alias}.${methodName}`;
        } else {
          callName = alias;
        }
      }

      const args = (Array.isArray(record.args) ? record.args : []).map(a => this.serializeValue(a, registry)).join(', ');

      return `${callName}(${args})`;
    }

    const entries = Object.entries(record).sort(([a], [b]) => compareCodePoint(a, b));
    const props = entries.map(([key, entryValue]) => {
      if (key.startsWith('__bunner_computed_')) {
        const computed = asRecord(entryValue) ?? {};
        const keyContent = this.serializeValue(computed.__bunner_computed_key, registry);
        const valContent = this.serializeValue(computed.__bunner_computed_value, registry);

        return `[${keyContent}]: ${valContent}`;
      }

      return `'${key}': ${this.serializeValue(entryValue, registry)}`;
    });

    return `{ ${props.join(', ')} }`;
  }

  private resolveConstructorDeps(meta: ClassMetadata, node: ModuleNode, graph: ModuleGraph): string[] {
    return meta.constructorParams.map(param => {
      let token: unknown = param.type;
      const refName = getRefName(token);
      const forwardRefName = getForwardRefName(token);

      if (refName) {
        token = refName;
      } else if (forwardRefName) {
        token = forwardRefName;
      }

      const injectDec = param.decorators.find(d => d.name === 'Inject');

      if (injectDec && injectDec.arguments.length > 0) {
        const arg = injectDec.arguments[0];

        if (typeof arg === 'string') {
          token = arg;
        } else {
          const argRefName = getRefName(arg);
          const argForwardRefName = getForwardRefName(arg);

          if (argRefName) {
            token = argRefName;
          } else if (argForwardRefName) {
            token = argForwardRefName;
          }
        }
      }

      if (typeof token !== 'string') {
        return 'undefined';
      }

      const resolvedToken = graph.resolveToken(node.name, token);

      if (resolvedToken) {
        return `c.get('${resolvedToken}')`;
      }

      const targetModule = graph.classMap.get(token);

      if (targetModule) {
        return `c.get('${targetModule.name}::${token}')`;
      }

      return `c.get('${token}')`;
    });
  }
}
