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

    // Iterate all modules
    graph.modules.forEach(node => {
      // 1. Generate Factories for Providers
      node.providers.forEach((ref, token) => {
        // Find ClassMetadata for this provider
        const classInfo = graph.classMap.get(token);
        if (!classInfo) {
          // TODO: Custom providers (useValue/useFactory) handled later
          if (ref.metadata && ref.metadata.useValue) {
            // Simple value provider
            factoryEntries.push(`  container.set('${node.name}::${token}', () => ${JSON.stringify(ref.metadata.useValue)});`);
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

    return `
import { Container } from "@bunner/core";
${imports.join('\n')}

export function createContainer() {
  const container = new Container();
${factoryEntries.join('\n')}
  return container;
}
`;
  }

  private resolveConstructorDeps(meta: ClassMetadata, node: ModuleNode, graph: ModuleGraph): string[] {
    return meta.constructorParams.map(param => {
      // 1. Check for @Inject(Token)
      // const injectDec = param.decorators.find(d => d.name === 'Inject');
      // let token = injectDec ? injectDec.arguments[0] : param.type;

      // Simplified for Phase 1: Use type name as token
      const token = param.type;
      if (typeof token !== 'string') {
        return 'undefined';
      }

      // 2. Resolve in Graph
      const resolvedToken = graph.resolveToken(node.name, token);

      if (resolvedToken) {
        return `c.get('${resolvedToken}')`;
      }
      // Fallback or explicit global?
      console.warn(`⚠️  [Generator] Could not resolve dependency '${token}' in module '${node.name}'`);
      return `c.get('${token}')`; // Try global/unscoped as hail mary
    });
  }
}
