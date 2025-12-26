import { type ClassMetadata, ModuleGraph, type ProviderRef, type ModuleNode } from '../analyzer';

import type { ImportRegistry } from './import-registry';

export class InjectorGenerator {
  private hasLogger = false;

  generate(graph: ModuleGraph, registry: ImportRegistry): string {
    this.hasLogger = false;

    const factoryEntries: string[] = [];
    // Helper to get alias
    const getAlias = (name: string, path?: string) => {
      if (!path) {
        return name;
      }

      return registry.getAlias(name, path);
    };

    graph.modules.forEach((node: ModuleNode) => {
      node.providers.forEach((ref: ProviderRef, token: string) => {
        const metaProvider = ref.metadata;

        if (metaProvider) {
          if (metaProvider.useValue) {
            factoryEntries.push(`  container.set('${node.name}::${token}', () => ${JSON.stringify(metaProvider.useValue)});`);

            return;
          }

          if (metaProvider.useClass) {
            const classes = Array.isArray(metaProvider.useClass) ? metaProvider.useClass : [metaProvider.useClass];
            const instances = classes.map((clsItem: any) => {
              const className = clsItem.__bunner_ref || clsItem;
              const clsNode = graph.classMap.get(className);

              if (!clsNode) {
                return 'undefined'; // Should ideally warn
              }

              const alias = getAlias(clsNode.metadata.className, clsNode.filePath);
              const deps = this.resolveConstructorDeps(clsNode.metadata, node, graph);

              return `new ${alias}(${deps.join(', ')})`;
            });
            const factoryBody = Array.isArray(metaProvider.useClass) ? `[${instances.join(', ')}]` : instances[0];

            factoryEntries.push(`  container.set('${node.name}::${token}', (c) => ${factoryBody});`);

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

              factoryEntries.push(`  container.set('${node.name}::${token}', async (c) => {
                        const factory = ${factoryFn};
                        return factory(${injectedArgs.join(', ')});
                    });`);

              return;
            }
          }
        }

        const classInfo = graph.classMap.get(token);
        // Note: graph.classMap is ClassName based.
        // If duplicates exist, it returns ONE of them.
        // We hope `token` (ClassName) matches uniqueness or we luck out.
        // For standard usage, it matches.

        if (!classInfo) {
          return;
        }

        const alias = getAlias(classInfo.metadata.className, classInfo.filePath);
        const deps = this.resolveConstructorDeps(classInfo.metadata, node, graph);

        factoryEntries.push(`  container.set('${node.name}::${token}', (c) => new ${alias}(${deps.join(', ')}));`);
      });
      node.controllers.forEach((ctrlName: string) => {
        const classInfo = graph.classMap.get(ctrlName);

        if (!classInfo) {
          return;
        }

        const alias = getAlias(classInfo.metadata.className, classInfo.filePath);
        const deps = this.resolveConstructorDeps(classInfo.metadata, node, graph);

        factoryEntries.push(`  container.set('${node.name}::${ctrlName}', (c) => new ${alias}(${deps.join(', ')}));`);
      });
    });

    const dynamicEntries: string[] = [];

    graph.modules.forEach((node: ModuleNode) => {
      node.dynamicImports.forEach((imp: any) => {
        if (imp.__bunner_call) {
          const [className, _methodName] = imp.__bunner_call.split('.');
          // handle dynamic imports (usually helpers).
          // For now left as is (assume lib call)
          let callExpression = imp.__bunner_call;

          if (imp.__bunner_import_source) {
            const alias = registry.getAlias(className, imp.__bunner_import_source);

            if (_methodName) {
              callExpression = `${alias}.${_methodName}`;
            } else {
              callExpression = alias;
            }
          }

          const args = imp.args.map((a: any) => JSON.stringify(a)).join(', ');

          dynamicEntries.push(`  const mod_${node.name}_${className} = await ${callExpression}(${args});`);
          dynamicEntries.push(`  await container.loadDynamicModule('${className}', mod_${node.name}_${className});`);
        }
      });
    });

    if (this.hasLogger) {
      // Logger handled in global imports? No, need to import it.
      // Registry handles User imports. Logger is lib import.
      // We can add it manually to output.
    }

    // We rely on Manifest to print Registry imports.
    // But Wrapper imports (Core, Logger) need to be here.
    return `
import { Container } from "@bunner/core";
import { Logger } from "@bunner/logger";

export function createContainer() {
  const container = new Container();
${factoryEntries.join('\n')}
  return container;
}

export async function registerDynamicModules(container: any) {
${dynamicEntries.join('\n')}
}
`;
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
        this.hasLogger = true;

        // Logger doesn't need alias if we import it globally
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

      return `c.get('${token}')`;
    });
  }
}
