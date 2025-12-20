import { type ClassMetadata } from '../analyzer/ast-parser';
import { ModuleGraph, type ModuleNode, type ProviderRef } from '../analyzer/graph/module-graph';
import { PathResolver } from '../utils/path-resolver';

export class InjectorGenerator {
  private hasLogger = false;

  generate(graph: ModuleGraph, outputDir: string): string {
    this.hasLogger = false;
    const imports: string[] = [];
    const factoryEntries: string[] = [];
    const importedIdentifiers = new Set<string>();

    const addImport = (className: string, filePath?: string) => {
      if (!filePath) {
        return;
      }
      if (!importedIdentifiers.has(className)) {
        const relativePath = PathResolver.getRelativeImportPath(outputDir + '/dummy.ts', filePath);
        imports.push(`import { ${className} } from "${relativePath}";`);
        importedIdentifiers.add(className);
      }
    };

    const addLibImport = (className: string, libPath: string) => {
      if (!importedIdentifiers.has(className)) {
        imports.push(`import { ${className} } from "${libPath}";`);
        importedIdentifiers.add(className);
      }
    };

    graph.modules.forEach((node: ModuleNode) => {
      node.providers.forEach((ref: ProviderRef, token: string) => {
        const classInfo = graph.classMap.get(token);
        if (!classInfo) {
          if (ref.metadata) {
            if (ref.metadata.useValue) {
              factoryEntries.push(`  container.set('${node.name}::${token}', () => ${JSON.stringify(ref.metadata.useValue)});`);
            } else if (ref.metadata.useFactory) {
              const factoryFn = ref.metadata.useFactory.__bunner_factory_code;
              if (factoryFn) {
                const injectedArgs = (ref.metadata.inject || []).map((injectItem: any) => {
                  const tokenName = injectItem.__bunner_ref || injectItem;
                  const resolved = graph.resolveToken(node.name, tokenName) || tokenName;
                  return `c.get('${resolved}')`;
                });

                factoryEntries.push(`  container.set('${node.name}::${token}', async (c) => {
                        const factory = ${factoryFn};
                        return factory(${injectedArgs.join(', ')});
                    });`);
              }
            }
          }
          return;
        }

        addImport(classInfo.metadata.className, classInfo.filePath);

        const deps = this.resolveConstructorDeps(classInfo.metadata, node, graph);
        factoryEntries.push(
          `  container.set('${node.name}::${token}', (c) => new ${classInfo.metadata.className}(${deps.join(', ')}));`,
        );
      });

      node.controllers.forEach((ctrlName: string) => {
        const classInfo = graph.classMap.get(ctrlName);
        if (!classInfo) {
          return;
        }

        addImport(classInfo.metadata.className, classInfo.filePath);

        const deps = this.resolveConstructorDeps(classInfo.metadata, node, graph);
        factoryEntries.push(
          `  container.set('${node.name}::${ctrlName}', (c) => new ${classInfo.metadata.className}(${deps.join(', ')}));`,
        );
      });
    });

    const dynamicEntries: string[] = [];
    graph.modules.forEach((node: ModuleNode) => {
      node.dynamicImports.forEach((imp: any) => {
        if (imp.__bunner_call) {
          const [className, _methodName] = imp.__bunner_call.split('.');

          const importSource = node.metadata.imports && node.metadata.imports[className];

          if (importSource) {
            if (importSource.startsWith('.')) {

            } else {
              addLibImport(className, importSource);
            }
          } else {
            const classInfo = graph.classMap.get(className);
            if (classInfo) {
              addImport(className, classInfo.filePath);
            }
          }

          const args = imp.args.map((a: any) => JSON.stringify(a)).join(', ');
          dynamicEntries.push(`  const mod_${node.name}_${className} = await ${imp.__bunner_call}(${args});`);
          dynamicEntries.push(`  await container.loadDynamicModule('${className}', mod_${node.name}_${className});`);
        }
      });
    });

    if (this.hasLogger) {
      imports.push('import { Logger } from "@bunner/logger";');
    }

    return `
import { Container } from "@bunner/core";
${imports.join('\n')}

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

      if (token === 'Logger') {
        this.hasLogger = true;
        return `new Logger(${meta.className})`;
      }

      const injectDec = param.decorators.find((d: any) => d.name === 'Inject');
      if (injectDec && injectDec.arguments.length > 0) {
        const arg = injectDec.arguments[0];
        if (typeof arg === 'string') {
          token = arg;
        } else if (arg.__bunner_forward_ref) {
          token = arg.__bunner_forward_ref;
        } else if (arg.__bunner_ref) {
          token = arg.__bunner_ref;
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