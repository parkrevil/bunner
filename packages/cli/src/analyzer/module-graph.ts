import type { ClassMetadata } from './ast-parser';

export interface ProviderRef {
  token: any;
  metadata?: any;
  isExported: boolean;
}

export interface ClassInfo {
  metadata: ClassMetadata;
  filePath: string;
}

export class ModuleNode {
  name: string;
  metadata: ClassMetadata;
  filePath: string;
  imports: Set<ModuleNode> = new Set();
  dynamicImports: Set<any> = new Set(); // Stores { __bunner_call: string, args: [] }
  providers: Map<string, ProviderRef> = new Map();
  exports: Set<string> = new Set();
  controllers: Set<string> = new Set();

  constructor(info: ClassInfo) {
    this.name = info.metadata.className;
    this.metadata = info.metadata;
    this.filePath = info.filePath;
  }
}

export class ModuleGraph {
  public modules: Map<string, ModuleNode> = new Map();
  // Map to find which module a non-module class belongs to (for faster lookup if needed)
  public classMap: Map<string, ClassInfo> = new Map();

  constructor(private allClasses: ClassInfo[]) {
    this.allClasses.forEach(c => this.classMap.set(c.metadata.className, c));
  }

  build() {
    // 1. Create Nodes
    this.allClasses.forEach(info => {
      const moduleDec = info.metadata.decorators.find(d => d.name === 'Module');
      if (moduleDec) {
        this.modules.set(info.metadata.className, new ModuleNode(info));
      }
    });

    // 2. Link & Populate
    this.modules.forEach(node => {
      this.populateNode(node);
    });

    // 3. Resolve Imports
    this.modules.forEach(node => {
      this.linkImports(node);
    });

    return this.modules;
  }

  resolveToken(moduleName: string, token: string): string | null {
    const node = this.modules.get(moduleName);
    if (!node) {
      return null;
    }

    // 1. Check Self
    if (node.providers.has(token)) {
      return `${moduleName}::${token}`;
    }

    // 2. Check Imports
    for (const imported of node.imports) {
      if (imported.exports.has(token)) {
        return this.findExportingModule(imported, token);
      }
    }

    return null;
  }

  private populateNode(node: ModuleNode) {
    const moduleDec = node.metadata.decorators.find(d => d.name === 'Module')!;
    const args = moduleDec.arguments[0] || {};

    // Providers
    (args.providers || []).forEach((p: any) => {
      const ref = this.normalizeProvider(p);
      this.providersAdd(node, ref);
    });

    // Controllers
    (args.controllers || []).forEach((c: any) => {
      const name = c.__bunner_ref || c;
      if (typeof name === 'string') {
        node.controllers.add(name);
      }
    });

    // Exports
    (args.exports || []).forEach((e: any) => {
      const token = this.extractToken(e);
      if (token) {
        node.exports.add(token);
      }
    });
  }

  private linkImports(node: ModuleNode) {
    const moduleDec = node.metadata.decorators.find(d => d.name === 'Module')!;
    const args = moduleDec.arguments[0] || {};

    (args.imports || []).forEach((imp: any) => {
      const helper = (importName: string) => {
        const importedModule = this.modules.get(importName);
        if (importedModule) {
          node.imports.add(importedModule);
        } else {
          console.warn(`⚠️  Module '${node.name}' imports unknown module '${importName}'`);
        }
      };

      if (imp.__bunner_ref) {
        helper(imp.__bunner_ref);
      } else if (imp.__bunner_call) {
        // Dynamic Import
        node.dynamicImports.add(imp);
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

    // TODO: Handle Re-exports recursively if needed
    return null;
  }
}
