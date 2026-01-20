import { compareCodePoint } from '../../common';
import type { ClassMetadata } from '../interfaces';
import { ModuleDiscovery } from '../module-discovery';

import type { CyclePath, ProviderRef, FileAnalysis } from './interfaces';
import { ModuleNode } from './module-node';

type InjectableOptions = {
  readonly visibility?: string;
  readonly lifetime?: string;
};

export class ModuleGraph {
  public modules: Map<string, ModuleNode> = new Map();
  public classMap: Map<string, ModuleNode> = new Map();
  public classDefinitions: Map<string, { metadata: ClassMetadata; filePath: string }> = new Map();

  constructor(
    private fileMap: Map<string, FileAnalysis>,
    private moduleFileName: string,
  ) {}

  build(): Map<string, ModuleNode> {
    const allFiles = Array.from(this.fileMap.keys()).sort(compareCodePoint);
    const discovery = new ModuleDiscovery(allFiles, this.moduleFileName);
    const moduleMap = discovery.discover();

    discovery.getOrphans();

    const moduleEntries = Array.from(moduleMap.entries()).sort(([a], [b]) => compareCodePoint(a, b));

    for (const [modulePath, files] of moduleEntries) {
      const moduleFile = this.fileMap.get(modulePath);
      const rawDef = moduleFile?.moduleDefinition;

      if (!moduleFile) {
        continue;
      }

      const syntheticMeta: ClassMetadata = {
        className: rawDef?.name || 'AnonymousModule',
        heritage: undefined,
        decorators: [],
        constructorParams: [],
        methods: [],
        properties: [],
        imports: moduleFile.imports || {},
      };
      const node = new ModuleNode(syntheticMeta);

      node.filePath = modulePath;
      node.name = rawDef?.name || 'AnonymousModule';
      node.moduleDefinition = rawDef;

      this.modules.set(modulePath, node);

      const sortedOwnedFiles = Array.from(files).sort(compareCodePoint);

      sortedOwnedFiles.forEach(filePath => {
        const fileAnalysis = this.fileMap.get(filePath);

        if (!fileAnalysis) {
          return;
        }

        fileAnalysis.classes.forEach(cls => {
          this.classMap.set(cls.className, node);
          this.classDefinitions.set(cls.className, { metadata: cls, filePath });

          const isController = cls.decorators.some(d => d.name === 'Controller' || d.name === 'RestController');
          const isInjectable = cls.decorators.some(d => d.name === 'Injectable');

          if (isController) {
            node.controllers.add(cls.className);
          }

          if (isInjectable) {
            const token = cls.className;
            const injectableDec = cls.decorators.find(d => d.name === 'Injectable');
            const options = this.parseInjectableOptions(injectableDec?.arguments?.[0]);
            const visibility = options.visibility || 'internal';
            const lifetime = options.lifetime || 'singleton';

            node.providers.set(token, {
              token,
              metadata: cls,
              isExported: visibility === 'exported',
              scope: lifetime,
              filePath: filePath,
            });
          }
        });
      });

      if (rawDef && rawDef.providers) {
        rawDef.providers.forEach((p: unknown) => {
          const record = this.asRecord(p);

          if (record && typeof record.__bunner_spread === 'string') {
            node.dynamicProviderBundles.add(record.__bunner_spread);

            return;
          }

          const ref = this.normalizeProvider(p);

          if (node.providers.has(ref.token) && !this.isImplicit(node.providers.get(ref.token))) {
            throw new Error(
              `[Bunner AOT] Ambiguous provider '${ref.token}' in module '${node.name}' (${node.filePath}). Duplicate explicit definition.`,
            );
          }

          if (node.providers.has(ref.token)) {
            const prev = node.providers.get(ref.token);

            if (this.isImplicit(prev)) {
              const metaRecord = this.asRecord(ref.metadata);

              if (metaRecord && typeof metaRecord.__bunner_ref === 'string') {
                ref.metadata = prev?.metadata;
                ref.filePath = prev?.filePath;

                if (!ref.scope) {
                  ref.scope = prev?.scope;
                }

                if (prev?.isExported) {
                  ref.isExported = true;
                }
              }
            }
          }

          node.providers.set(ref.token, ref);
        });
      }
    }

    this.validateVisibilityAndScope();

    const cycles = this.detectCycles();

    if (cycles.length > 0) {
      const summary = cycles.map(c => c.path.join(' -> ')).join('\n');

      throw new Error(`[Bunner AOT] Circular dependency detected:\n${summary}`);
    }

    return this.modules;
  }

  detectCycles(): CyclePath[] {
    const nodes = Array.from(this.modules.values()).sort((a, b) => compareCodePoint(a.filePath, b.filePath));
    const adjacency = new Map<ModuleNode, ModuleNode[]>();

    nodes.forEach(node => {
      const next = new Set<ModuleNode>();
      const providerTokens = Array.from(node.providers.keys()).sort(compareCodePoint);

      providerTokens.forEach(token => {
        const provider = node.providers.get(token);

        if (!provider) {
          return;
        }

        const deps = this.extractDeps(provider);
        const sortedDeps = [...deps].sort(compareCodePoint);

        sortedDeps.forEach(depToken => {
          const target = this.classMap.get(depToken);

          if (!target) {
            return;
          }

          if (target === node) {
            return;
          }

          next.add(target);
        });
      });
      adjacency.set(
        node,
        Array.from(next).sort((a, b) => compareCodePoint(a.filePath, b.filePath)),
      );
    });

    const cycles: CyclePath[] = [];
    const cycleKeys = new Set<string>();
    const visited = new Set<ModuleNode>();
    const inStack = new Set<ModuleNode>();
    const stack: ModuleNode[] = [];
    const recordCycle = (cycle: ModuleNode[]): void => {
      const names = cycle.map(n => n.name);
      const normalized = this.normalizeCycle(names);
      const key = normalized.join('->');

      if (cycleKeys.has(key)) {
        return;
      }

      cycleKeys.add(key);
      cycles.push({ path: normalized });
    };
    const dfs = (node: ModuleNode): void => {
      if (inStack.has(node)) {
        const startIndex = stack.indexOf(node);

        if (startIndex >= 0) {
          recordCycle(stack.slice(startIndex).concat(node));
        }

        return;
      }

      if (visited.has(node)) {
        return;
      }

      visited.add(node);
      inStack.add(node);
      stack.push(node);

      const next = adjacency.get(node) || [];

      next.forEach(n => {
        dfs(n);
      });
      stack.pop();
      inStack.delete(node);
    };

    nodes.forEach(node => {
      dfs(node);
    });

    return cycles;
  }

  resolveToken(_moduleName: string, _token: string): string | null {
    return null;
  }

  private isImplicit(ref: ProviderRef | undefined): boolean {
    return this.isClassMetadata(ref?.metadata);
  }

  private validateVisibilityAndScope() {
    this.modules.forEach(node => {
      node.providers.forEach(provider => {
        if (!provider.metadata) {
          return;
        }

        const deps = this.extractDeps(provider);

        deps.forEach(depToken => {
          const targetModule = this.classMap.get(depToken);

          if (!targetModule) {
            return;
          }

          if (targetModule === node) {
            return;
          }

          const targetProvider = targetModule.providers.get(depToken);

          if (!targetProvider) {
            return;
          }

          if (!targetProvider.isExported) {
            throw new Error(
              `[Bunner AOT] Visibility Violation: '${provider.token}' in module '${node.name}' tries to inject '${depToken}' from '${targetModule.name}', but it is NOT exported.`,
            );
          }

          const sourceScope = provider.scope || 'singleton';
          const targetScope = targetProvider.scope || 'singleton';

          if (sourceScope === 'singleton' && targetScope === 'request-context') {
            throw new Error(
              `[Bunner AOT] Scope Violation: Singleton '${provider.token}' cannot inject Request-Scoped '${depToken}'.`,
            );
          }
        });
      });
    });
  }

  private extractDeps(provider: ProviderRef): string[] {
    if (!provider.metadata) {
      return [];
    }

    if (this.isClassMetadata(provider.metadata)) {
      return provider.metadata.constructorParams
        .map(p => {
          const injectDec = p.decorators.find(d => d.name === 'Inject');

          if (injectDec) {
            const token = injectDec.arguments[0];

            if (typeof token === 'string') {
              return token;
            }

            const extracted = this.extractTokenName(token);

            if (extracted !== 'UNKNOWN') {
              return extracted;
            }
          }

          return this.extractTokenName(p.type);
        })
        .filter(v => v !== 'UNKNOWN');
    }

    const record = this.asRecord(provider.metadata);

    if (record && Array.isArray(record.inject)) {
      return record.inject.map(v => this.extractTokenName(v)).filter(v => v !== 'UNKNOWN');
    }

    return [];
  }

  private normalizeProvider(p: unknown): ProviderRef {
    let token = 'UNKNOWN';
    const isExported = false;
    const scope = 'singleton';
    const record = this.asRecord(p);

    if (record && record.provide !== undefined) {
      token = this.extractTokenName(record.provide);
    } else if (typeof p === 'function') {
      token = p.name;
    } else if (record && typeof record.__bunner_ref === 'string') {
      token = record.__bunner_ref;
    }

    return { token, metadata: p, isExported, scope };
  }

  private extractTokenName(t: unknown): string {
    if (typeof t === 'string') {
      return t;
    }

    if (typeof t === 'function') {
      return t.name;
    }

    if (typeof t === 'symbol') {
      return t.description || t.toString();
    }

    const record = this.asRecord(t);

    if (record && typeof record.__bunner_ref === 'string') {
      return record.__bunner_ref;
    }

    return 'UNKNOWN';
  }

  private normalizeCycle(path: readonly string[]): string[] {
    if (path.length === 0) {
      return [];
    }

    const unique = path[0] === path[path.length - 1] ? path.slice(0, -1) : [...path];

    if (unique.length === 0) {
      return [];
    }

    let best = unique;

    for (let i = 1; i < unique.length; i += 1) {
      const rotated = unique.slice(i).concat(unique.slice(0, i));

      if (this.compareStringArray(rotated, best) < 0) {
        best = rotated;
      }
    }

    return best;
  }

  private compareStringArray(a: readonly string[], b: readonly string[]): number {
    const len = Math.min(a.length, b.length);

    for (let i = 0; i < len; i += 1) {
      const left = a[i];
      const right = b[i];

      if (left === undefined || right === undefined) {
        continue;
      }

      const diff = compareCodePoint(left, right);

      if (diff !== 0) {
        return diff;
      }
    }

    return a.length - b.length;
  }

  private isClassMetadata(value: unknown): value is ClassMetadata {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const record = value as Record<string, unknown>;

    return (
      typeof record.className === 'string' &&
      Array.isArray(record.decorators) &&
      Array.isArray(record.constructorParams) &&
      Array.isArray(record.methods) &&
      Array.isArray(record.properties) &&
      typeof record.imports === 'object'
    );
  }

  private parseInjectableOptions(value: unknown): InjectableOptions {
    const record = this.asRecord(value);

    if (!record) {
      return {};
    }

    const visibility = typeof record.visibility === 'string' ? record.visibility : undefined;
    const lifetime = typeof record.lifetime === 'string' ? record.lifetime : undefined;

    return { visibility, lifetime };
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    return value as Record<string, unknown>;
  }
}
