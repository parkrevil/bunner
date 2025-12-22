import type { CyclePath, ProviderRef, FileAnalysis } from './interfaces';
import { ModuleNode } from './module-node';

export class ModuleGraph {
  public modules: Map<string, ModuleNode> = new Map(); // Key: FilePath
  public classMap: Map<string, ModuleNode> = new Map(); // Key: ClassName

  constructor(private fileMap: Map<string, FileAnalysis>) {}

  build() {
    // 1. Create Nodes
    for (const [filePath, analysis] of this.fileMap.entries()) {
      analysis.classes.forEach(info => {
        const moduleDec = info.metadata.decorators.find(d => d.name === 'Module' || d.name === 'RootModule');

        // Create a wrapper node for every class to facilitate lookup by Injector
        // Even if it's not a Module, we need its metadata and file path.
        const node = new ModuleNode(info);
        node.filePath = filePath;

        // Index all classes
        // Warning: This assumes unique class names or last-wins for now.
        // Ideally we should use ImportRegistry logic, but InjectorGenerator relies on this map.
        this.classMap.set(info.metadata.className, node);

        if (moduleDec) {
          this.modules.set(filePath, node);
        }
      });
    }

    // 2. Populate and Link
    this.modules.forEach(node => {
      this.populateNode(node);
    });

    this.modules.forEach(node => {
      this.linkImports(node);
    });

    return this.modules;
  }

  detectCycles(): CyclePath[] {
    const cycles: CyclePath[] = [];

    this.modules.forEach(node => {
      node.visited = false;
      node.visiting = false;
    });

    this.modules.forEach(node => {
      if (!node.visited) {
        this._detectCyclesRecursive(node, [], cycles);
      }
    });

    return cycles;
  }

  resolveToken(moduleName: string, token: string): string | null {
    const node = this.classMap.get(moduleName);
    if (!node) {
      return null;
    }

    if (node.providers.has(token)) {
      return `${node.name}::${token}`;
    }

    for (const imported of node.imports) {
      if (this.isExportedFromModule(imported, token)) {
        return `${imported.name}::${token}`;
      }
    }

    return null;
  }

  private isExportedFromModule(node: ModuleNode, token: string, visited = new Set<string>()): boolean {
    if (visited.has(node.filePath)) {
      return false;
    }
    visited.add(node.filePath);

    if (node.exports.has(token)) {
      return true;
    }

    // Direct exports check is usually enough for module linkage logic
    // But if we want to confirm recursive exports availability:
    return false;
  }

  private _detectCyclesRecursive(node: ModuleNode, stack: ModuleNode[], cycles: CyclePath[]) {
    node.visiting = true;
    stack.push(node);

    for (const neighbor of node.imports) {
      if (neighbor.visiting) {
        const cycleStartIndex = stack.findIndex(n => n === neighbor);
        const cycleNodes = stack.slice(cycleStartIndex);
        cycleNodes.push(neighbor);

        const pathNames = cycleNodes.map(n => n.name);

        const source = pathNames[0];
        const target = pathNames[1];

        cycles.push({
          path: pathNames,
          suggestedFix: `Circular dependency detected: ${pathNames.join(' -> ')}. Try using forwardRef in ${source}: imports: [forwardRef(() => ${target})]`,
        });
      } else if (!neighbor.visited) {
        this._detectCyclesRecursive(neighbor, stack, cycles);
      }
    }

    stack.pop();
    node.visiting = false;
    node.visited = true;
  }

  private populateNode(node: ModuleNode) {
    const moduleDec = node.metadata.decorators.find(d => d.name === 'Module' || d.name === 'RootModule')!;
    const args = moduleDec.arguments[0] || {};

    (args.providers || []).forEach((p: any) => {
      const ref = this.normalizeProvider(p);
      this.providersAdd(node, ref);
    });

    (args.controllers || []).forEach((c: any) => {
      const name = c.__bunner_ref || c;
      if (typeof name === 'string') {
        node.controllers.add(name);
      }
    });

    (args.exports || []).forEach((e: any) => {
      const token = this.extractToken(e);
      if (token) {
        node.exports.add(token);
      }
    });
  }

  private linkImports(node: ModuleNode) {
    const moduleDec = node.metadata.decorators.find(d => d.name === 'Module' || d.name === 'RootModule')!;
    const args = moduleDec.arguments[0] || {};
    const importsMeta = node.metadata.imports || {};

    (args.imports || []).forEach((imp: any) => {
      if (imp.__bunner_ref) {
        const importName = imp.__bunner_ref;
        const absPath = importsMeta[importName];

        if (absPath) {
          this.resolveModuleFromPath(node, absPath, importName);
        } else {
          // Same file Check
          const sameFileNode = this.classMap.get(importName);
          if (sameFileNode && sameFileNode.filePath === node.filePath) {
            node.imports.add(sameFileNode);
          }
        }
      } else if (imp.__bunner_call) {
        node.dynamicImports.add(imp);
      } else if (imp.__bunner_forward_ref) {
        const importName = imp.__bunner_forward_ref;
        const absPath = importsMeta[importName];

        if (absPath) {
          this.resolveModuleFromPath(node, absPath, importName);
        } else {
          const sameFileNode = this.classMap.get(importName);
          if (sameFileNode && sameFileNode.filePath === node.filePath) {
            node.imports.add(sameFileNode);
          }
        }
      }
    });
  }

  private resolveModuleFromPath(parentNode: ModuleNode, targetPath: string, targetName: string, visited = new Set<string>()) {
    if (visited.has(targetPath)) {
      return;
    }
    visited.add(targetPath);

    const fileKey = this.findFileKey(targetPath);
    if (!fileKey) {
      return;
    }

    const fileAnalysis = this.fileMap.get(fileKey)!;

    // 1. Direct Export from File
    if (fileAnalysis.exports.includes(targetName)) {
      const cls = fileAnalysis.classes.find(c => c.metadata.className === targetName);
      if (cls) {
        // It's a class in this file. Is it a module?
        // We need to look up in classMap but verify filePath.
        const node = this.classMap.get(targetName);
        if (node && node.filePath === fileKey) {
          parentNode.imports.add(node);
          return;
        }
      }
    }

    // 2. Re-exports (Recursive)
    for (const re of fileAnalysis.reExports) {
      if (re.exportAll) {
        this.resolveModuleFromPath(parentNode, re.module, targetName, visited);
      } else if (re.names) {
        const match = re.names.find(n => n.exported === targetName);
        if (match) {
          // Aliased export logic: find 'local' in 'module'
          this.resolveModuleFromPath(parentNode, re.module, match.local, visited);
          return;
        }
      }
    }
  }

  private findFileKey(path: string): string | undefined {
    // Exact match
    if (this.fileMap.has(path)) {
      return path;
    }
    // Add extension
    if (this.fileMap.has(path + '.ts')) {
      return path + '.ts';
    }
    // Index
    if (this.fileMap.has(path + '/index.ts')) {
      return path + '/index.ts';
    }

    // Fuzzy search (slow but safe for weird paths)
    // Only if not found exact
    for (const key of this.fileMap.keys()) {
      if (key.replace(/\.ts$/, '') === path.replace(/\.ts$/, '')) {
        return key;
      }
    }
    return undefined;
  }

  private normalizeProvider(p: any): ProviderRef {
    if (typeof p === 'string') {
      return { token: p, isExported: false };
    }
    if (p.__bunner_ref) {
      return { token: p.__bunner_ref, isExported: false };
    }
    if (p.provide) {
      return { token: p.provide, metadata: p, isExported: false };
    }
    return { token: 'UNKNOWN', isExported: false };
  }

  private providersAdd(node: ModuleNode, ref: ProviderRef) {
    let key = '';
    if (typeof ref.token === 'string') {
      key = ref.token;
    } else if (ref.token && ref.token.__bunner_ref) {
      key = ref.token.__bunner_ref;
    }

    if (key) {
      node.providers.set(key, ref);
    }
  }

  private extractToken(e: any): string | null {
    if (typeof e === 'string') {
      return e;
    }
    if (e.__bunner_ref) {
      return e.__bunner_ref;
    }
    if (e.provide) {
      return e.provide;
    }
    return null;
  }
}
