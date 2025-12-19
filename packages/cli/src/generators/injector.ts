import { type ClassMetadata } from '../analyzer/ast-parser';
import { ModuleGraph, type ModuleNode } from '../analyzer/module-graph';
import { PathResolver } from '../utils/path-resolver';

export class InjectorGenerator {
  generate(graph: ModuleGraph, outputDir: string): string {
    const imports: string[] = [];
    const factoryEntries: string[] = [];
    const importedIdentifiers = new Set<string>();

    // Helper to add imports
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

    // Helper for library imports
    const addLibImport = (className: string, libPath: string) => {
      if (!importedIdentifiers.has(className)) {
        imports.push(`import { ${className} } from "${libPath}";`);
        importedIdentifiers.add(className);
      }
    };

    // Iterate all modules
    graph.modules.forEach(node => {
      // 1. Generate Factories for Providers
      node.providers.forEach((ref, token) => {
        // Find ClassMetadata for this provider
        const classInfo = graph.classMap.get(token);
        if (!classInfo) {
          // Custom providers (useValue/useFactory)
          if (ref.metadata) {
            if (ref.metadata.useValue) {
              // Simple value provider
              factoryEntries.push(`  container.set('${node.name}::${token}', () => ${JSON.stringify(ref.metadata.useValue)});`);
            } else if (ref.metadata.useFactory) {
              // Factory Provider
              const factoryFn = ref.metadata.useFactory.__bunner_factory_code;
              if (factoryFn) {
                // Inject resolution
                const injectedArgs = (ref.metadata.inject || []).map((injectItem: any) => {
                  const tokenName = injectItem.__bunner_ref || injectItem;
                  const resolved = graph.resolveToken(node.name, tokenName) || tokenName;
                  return `c.get('${resolved}')`;
                });

                // We wrap the factory execution
                // factoryFn is likely "(config) => ..." or "async (c) => ..."
                // We need to call it: (extractedFn)(...args)
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
        // Key: ModuleName::Token
        factoryEntries.push(
          `  container.set('${node.name}::${token}', (c) => new ${classInfo.metadata.className}(${deps.join(', ')}));`,
        );
      });

      // 2. Generate Factories for Controllers
      node.controllers.forEach(ctrlName => {
        const classInfo = graph.classMap.get(ctrlName);
        if (!classInfo) {
          return;
        }

        addImport(classInfo.metadata.className, classInfo.filePath);

        const deps = this.resolveConstructorDeps(classInfo.metadata, node, graph);
        // Key: ModuleName::ControllerName
        factoryEntries.push(
          `  container.set('${node.name}::${ctrlName}', (c) => new ${classInfo.metadata.className}(${deps.join(', ')}));`,
        );
      });
    });

    // 3. Generate Dynamic Module Logic
    const dynamicEntries: string[] = [];
    graph.modules.forEach(node => {
      node.dynamicImports.forEach(imp => {
        if (imp.__bunner_call) {
          // e.g. "ConfigModule.forRoot"
          const [className, _methodName] = imp.__bunner_call.split('.');

          // Find import source for className in this module's file
          const importSource = node.metadata.imports && node.metadata.imports[className];

          if (importSource) {
            if (importSource.startsWith('.')) {
              // Relative import logic if needed
            } else {
              addLibImport(className, importSource);
            }
          } else {
            // Maybe it is in classMap?
            const classInfo = graph.classMap.get(className);
            if (classInfo) {
              addImport(className, classInfo.filePath);
            }
          }

          // Generate Call
          const args = imp.args.map((a: any) => JSON.stringify(a)).join(', ');
          dynamicEntries.push(`  // Dynamic Module: ${imp.__bunner_call}`);
          dynamicEntries.push(`  const mod_${node.name}_${className} = await ${imp.__bunner_call}(${args});`);
          dynamicEntries.push(`  await container.loadDynamicModule('${node.name}', mod_${node.name}_${className});`);
        }
      });
    });

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
    return meta.constructorParams.map(param => {
      let token = param.type;

      // 1. Check for @Inject(Token) or @Inject(forwardRef(() => Token))
      const injectDec = param.decorators.find(d => d.name === 'Inject');
      if (injectDec && injectDec.arguments.length > 0) {
        const arg = injectDec.arguments[0];
        if (typeof arg === 'string') {
          token = arg; // @Inject('SOME_STRING')
        } else if (arg.__bunner_forward_ref) {
          token = arg.__bunner_forward_ref; // @Inject(forwardRef(() => Token))
        } else if (arg.__bunner_ref) {
          token = arg.__bunner_ref; // @Inject(Token)
        }
      }

      if (typeof token !== 'string') {
        return 'undefined';
      }

      // 2. Resolve in Graph
      const resolvedToken = graph.resolveToken(node.name, token);

      if (resolvedToken) {
        return `c.get('${resolvedToken}')`;
      }

      // Fallback
      return `c.get('${token}')`;
    });
  }
}
