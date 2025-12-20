import type { ClassMetadata } from '../structure/metadata.structure';

export interface ProviderRef {
  token: any;
  metadata?: any;
  isExported: boolean;
}

export interface ClassInfo {
  metadata: ClassMetadata;
  filePath: string;
}

export interface CyclePath {
  path: string[];
  suggestedFix?: string;
}

export class ModuleNode {
  name: string;
  metadata: ClassMetadata;
  filePath: string;
  imports: Set<ModuleNode> = new Set();
  dynamicImports: Set<any> = new Set();
  providers: Map<string, ProviderRef> = new Map();
  exports: Set<string> = new Set();
  controllers: Set<string> = new Set();

  visiting: boolean = false;
  visited: boolean = false;

  constructor(info: ClassInfo) {
    this.name = info.metadata.className;
    this.metadata = info.metadata;
    this.filePath = info.filePath;
  }
}

export class ModuleGraph {
  public modules: Map<string, ModuleNode> = new Map();
  public classMap: Map<string, ClassInfo> = new Map();

  constructor(private allClasses: ClassInfo[]) {
    this.allClasses.forEach(c => this.classMap.set(c.metadata.className, c));
  }

  build() {
    this.allClasses.forEach(info => {
      const moduleDec = info.metadata.decorators.find(d => d.name === 'Module' || d.name === 'RootModule');
      if (moduleDec) {
        this.modules.set(info.metadata.className, new ModuleNode(info));
      }
    });

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
    const node = this.modules.get(moduleName);
    if (!node) {
      return null;
    }

    if (node.providers.has(token)) {
      return `${moduleName}::${token}`;
    }

    for (const imported of node.imports) {
      if (imported.exports.has(token)) {
        return this.findExportingModule(imported, token);
      }
    }

    return null;
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

    (args.imports || []).forEach((imp: any) => {
      const helper = (importName: string) => {
        const importedModule = this.modules.get(importName);
        if (importedModule) {
          node.imports.add(importedModule);
        } else {

        }
      };

      if (imp.__bunner_ref) {
        helper(imp.__bunner_ref);
      } else if (imp.__bunner_call) {
        node.dynamicImports.add(imp);
      } else if (imp.__bunner_forward_ref) {
        helper(imp.__bunner_forward_ref);
      }
    });
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

  private findExportingModule(node: ModuleNode, token: string): string | null {
    if (node.providers.has(token)) {
      return `${node.name}::${token}`;
    }

    return null;
  }
}