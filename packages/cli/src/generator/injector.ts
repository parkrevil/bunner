import { type ClassMetadata, ModuleGraph, type ProviderRef, type ModuleNode } from '../analyzer';

import type { ImportRegistry } from './import-registry';

export class InjectorGenerator {
  generate(graph: ModuleGraph, registry: ImportRegistry): string {
    const factoryEntries: string[] = [];
    const adapterConfigs: string[] = [];
    // Helper to get alias
    const getAlias = (name: string, path?: string) => {
      if (!path) {
        return name;
      }

      return registry.getAlias(name, path);
    };

    graph.modules.forEach((node: ModuleNode) => {
      // 1. Providers Generation
      node.providers.forEach((ref: ProviderRef, token: string) => {
        const metaProvider = ref.metadata;

        if (metaProvider) {
          if (Object.prototype.hasOwnProperty.call(metaProvider, 'useValue')) {
            const val = this.serializeValue(metaProvider.useValue, registry);

            factoryEntries.push(`  container.set('${node.name}::${token}', () => ${val});`);

            return;
          }

          if (metaProvider.useClass) {
            const classes = Array.isArray(metaProvider.useClass) ? metaProvider.useClass : [metaProvider.useClass];
            const instances = classes.map((clsItem: any) => {
              const className = clsItem.__bunner_ref || clsItem;
              const clsDef = graph.classDefinitions.get(className);

              if (!clsDef) {
                return 'undefined'; // Should ideally warn
              }

              const alias = getAlias(clsDef.metadata.className, clsDef.filePath);
              const deps = this.resolveConstructorDeps(clsDef.metadata, node, graph);

              return `new ${alias}(${deps.join(', ')})`;
            });
            const factoryBody = Array.isArray(metaProvider.useClass) ? `[${instances.join(', ')}]` : instances[0];

            factoryEntries.push(`  container.set('${node.name}::${token}', (c) => ${factoryBody});`);

            return;
          }

          if (metaProvider.useExisting) {
            const existingToken = this.serializeValue(metaProvider.useExisting, registry);

            // resolveToken logic?
            // Since factory is runtime, we just generate lookup.
            // But we need to scope it if possible.
            // Simplest: container.get(token)
            // But we might need 'scope::token' resolution.
            // Let's assume global lookup or same-module lookup for now.
            factoryEntries.push(`  container.set('${node.name}::${token}', (c) => c.get(${existingToken}));`);

            return;
          }

          if (metaProvider.useFactory) {
            let factoryFn = metaProvider.useFactory.__bunner_factory_code;
            const deps = metaProvider.useFactory.__bunner_factory_deps || [];

            if (factoryFn) {
              const replacements: { start: number; end: number; content: string }[] = [];

              deps.forEach((dep: any) => {
                const alias = registry.getAlias(dep.name, dep.path);

                if (alias !== dep.name) {
                  replacements.push({
                    start: dep.start,
                    end: dep.end,
                    content: alias,
                  });
                }
              });
              replacements
                .sort((a, b) => b.start - a.start)
                .forEach(rep => {
                  factoryFn = factoryFn.slice(0, rep.start) + rep.content + factoryFn.slice(rep.end);
                });

              const injectedArgs = (metaProvider.inject || []).map((injectItem: any) => {
                const tokenName = injectItem.__bunner_ref || injectItem;
                const resolved = graph.resolveToken(node.name, tokenName) || tokenName;

                return `c.get('${resolved}')`;
              });

              factoryEntries.push(`  container.set('${node.name}::${token}', (c) => {
                        const factory = ${factoryFn};
                        return factory(${injectedArgs.join(', ')});
                    });`);

              return;
            }
          }
        }

        // Implicit providers (Class directly)
        // If it's a class metadata structure
        if (metaProvider && metaProvider.className && metaProvider.constructorParams) {
          const clsMeta = metaProvider as ClassMetadata;
          const alias = getAlias(clsMeta.className, ref.filePath);
          const deps = this.resolveConstructorDeps(clsMeta, node, graph);

          factoryEntries.push(`  container.set('${node.name}::${token}', (c) => new ${alias}(${deps.join(', ')}));`);
        }
      });
      // 1.1 Dynamic Provider Bundles
      node.dynamicProviderBundles.forEach((bundleExpr: any) => {
        const bundleVal = this.serializeValue(bundleExpr, registry);

        factoryEntries.push(`
  (${bundleVal} || []).forEach(p => {
      let token = p.provide;
      if (typeof p === 'function') token = p.name;
      
      let factory;
      if(Object.prototype.hasOwnProperty.call(p, 'useValue')) factory = () => p.useValue;
      else if(p.useClass) factory = (c) => new p.useClass(...(resolveDeps(p.useClass))); 
      else if(p.useFactory) {
         factory = (c) => {
            const args = (p.inject || []).map(t => c.get(t));
            return p.useFactory(...args);
         };
      }
      
      const key = token ? '${node.name}::' + (typeof token === 'symbol' ? token.description : token) : null;
      if(key && factory) container.set(key, factory);
  });`);
      });

      // 2. Adapters Config Generation
      if (node.moduleDefinition && node.moduleDefinition.adapters) {
        const config = this.serializeValue(node.moduleDefinition.adapters, registry);

        adapterConfigs.push(`  '${node.name}': ${config},`);
      }
    });

    const dynamicEntries: string[] = [];

    // Dynamic modules handling (legacy support or libraries)
    graph.modules.forEach((node: ModuleNode) => {
      node.dynamicImports.forEach((imp: any) => {
        if (imp.__bunner_call) {
          const [className, _methodName] = imp.__bunner_call.split('.');
          let callExpression = imp.__bunner_call;

          if (imp.__bunner_import_source) {
            const alias = registry.getAlias(className, imp.__bunner_import_source);

            if (_methodName) {
              callExpression = `${alias}.${_methodName}`;
            } else {
              callExpression = alias;
            }
          }

          const args = imp.args.map((a: any) => this.serializeValue(a, registry)).join(', ');

          dynamicEntries.push(`  const mod_${node.name}_${className} = await ${callExpression}(${args});`);
          dynamicEntries.push(`  await container.loadDynamicModule('${className}', mod_${node.name}_${className});`);
        }
      });
    });

    return `
import { Container } from "@bunner/core";
import { Logger } from "@bunner/logger";

export function createContainer() {
  const container = new Container();
${factoryEntries.join('\n')}
  return container;
}

export const adapterConfig = {
${adapterConfigs.join('\n')}
};

export async function registerDynamicModules(container: any) {
${dynamicEntries.join('\n')}
}
`;
  }

  private serializeValue(value: any, registry: ImportRegistry): string {
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

    if (value.__bunner_ref) {
      return registry.getAlias(value.__bunner_ref, value.__bunner_import_source);
    }

    if (value.__bunner_call) {
      const parts = value.__bunner_call.split('.');
      const className = parts[0];
      const methodName = parts[1];
      let callName = value.__bunner_call;

      if (value.__bunner_import_source) {
        const alias = registry.getAlias(className, value.__bunner_import_source);

        if (methodName) {
          callName = `${alias}.${methodName}`;
        } else {
          callName = alias;
        }
      }

      const args = (value.args || []).map((a: any) => this.serializeValue(a, registry)).join(', ');

      return `${callName}(${args})`;
    }

    if (typeof value === 'object') {
      const props = Object.entries(value).map(([k, v]) => {
        if (k.startsWith('__bunner_computed_')) {
          const computed = v as any;
          const keyContent = this.serializeValue(computed.__bunner_computed_key, registry);
          const valContent = this.serializeValue(computed.__bunner_computed_value, registry);

          return `[${keyContent}]: ${valContent}`;
        }

        return `'${k}': ${this.serializeValue(v, registry)}`;
      });

      return `{ ${props.join(', ')} }`;
    }

    return 'undefined';
  }

  private resolveConstructorDeps(meta: ClassMetadata, node: ModuleNode, graph: ModuleGraph): string[] {
    return meta.constructorParams.map((param: any) => {
      let token = param.type;

      if (token && typeof token === 'object') {
        if (token.__bunner_ref) {
          token = token.__bunner_ref;
        } else if (token.__bunner_forward_ref) {
          token = token.__bunner_forward_ref;
        }
      }

      if (token === 'Logger') {
        return `new Logger('${meta.className}')`;
      }

      const injectDec = param.decorators.find((d: any) => d.name === 'Inject');

      if (injectDec && injectDec.arguments.length > 0) {
        const arg = injectDec.arguments[0];

        if (typeof arg === 'string') {
          token = arg;
        } else if (arg && typeof arg === 'object') {
          if (arg.__bunner_forward_ref) {
            token = arg.__bunner_forward_ref;
          } else if (arg.__bunner_ref) {
            token = arg.__bunner_ref;
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

      // Fallback: Try to find owning module for the token (assuming Class Name)
      const targetModule = graph.classMap.get(token);

      if (targetModule) {
        return `c.get('${targetModule.name}::${token}')`;
      }

      return `c.get('${token}')`;
    });
  }
}
