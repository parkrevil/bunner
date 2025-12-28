import type { ClassMetadata } from '../interfaces';
import { ModuleDiscovery } from '../module-discovery';

import type { CyclePath, ProviderRef, FileAnalysis } from './interfaces';
import { ModuleNode } from './module-node';

export class ModuleGraph {
  public modules: Map<string, ModuleNode> = new Map(); // Key: FilePath of __module__.ts
  public classMap: Map<string, ModuleNode> = new Map(); // Key: ClassName -> Owning ModuleNode
  public classDefinitions: Map<string, { metadata: ClassMetadata; filePath: string }> = new Map();

  constructor(private fileMap: Map<string, FileAnalysis>) {}

  build() {
    // 1. Discovery
    const allFiles = Array.from(this.fileMap.keys());
    const discovery = new ModuleDiscovery(allFiles);
    const moduleMap = discovery.discover();
    const orphans = discovery.getOrphans();

    if (orphans.size > 0) {
      // Ideally warn about orphans
    }

    // 2. Create Module Nodes
    for (const [modulePath, files] of moduleMap.entries()) {
      const moduleFile = this.fileMap.get(modulePath);
      // We create a "Virtual" ModuleNode derived from __module__.ts definition
      // But ModuleNode constructor takes specific ClassMetadata.
      // We might need to refactor ModuleNode or create a synthetic one.
      // Current ModuleNode is wrapper around ClassMetadata.
      // Let's adapt it to use ModuleDefinition if available.
      // We look for the "module" definition in this file.
      const rawDef = moduleFile?.moduleDefinition;

      if (!moduleFile) {
        continue;
      }

      // Create synthetic metadata for ModuleNode
      const syntheticMeta: any = {
        className: rawDef?.name || 'AnonymousModule',
        decorators: [],
        imports: moduleFile.imports || {},
        // ... fill others minimal
      };
      const node = new ModuleNode(syntheticMeta);

      node.filePath = modulePath;
      node.name = rawDef?.name || 'AnonymousModule';
      node.moduleDefinition = rawDef;

      this.modules.set(modulePath, node);
      // 3. Hydrate Module with Owned Files
      files.forEach(filePath => {
        const fileAnalysis = this.fileMap.get(filePath);

        if (!fileAnalysis) {
          return;
        }

        fileAnalysis.classes.forEach(cls => {
          // Add to classMap for lookup
          this.classMap.set(cls.className, node);
          this.classDefinitions.set(cls.className, { metadata: cls, filePath });

          // Check for Standalone Components (@Controller, @RestController, @Service/Injectable?)
          // Actually, we just need to know if they are Providers or Controllers.
          // Discovery of "Implicit Providers" happens here?
          // PLAN says: "@Controller, @Service같은 Standalone 컴포넌트를 __module__.ts에 등록하지 않아도 AOT가 수집하여 모듈 스코프로 귀속시킨다."

          const isController = cls.decorators?.some((d: any) => ['Controller', 'RestController'].includes(d.name));
          const isInjectable = cls.decorators?.some((d: any) => d.name === 'Injectable');

          if (isController) {
            node.controllers.add(cls.className);
          }

          if (isInjectable) {
            // Add implicit provider
            // Check for Ambiguity here?
            const token = cls.className;

            if (node.providers.has(token)) {
              // Conflict between implicit provider and explicit provider?
              // Explicit wins? Or Error? Plan says "Conflict/Ambiguity is build failure".
              // But manual override in __module__.ts should be allowed.
              // If manual override exists, we skip implicit adding.
              // But we haven't processed manual providers yet.
            }

            // We add it tentatively.
            // ProviderRef needs to store visibility info.
            // Extract options from @Injectable(options)
            const injectableDec = cls.decorators.find((d: any) => d.name === 'Injectable');
            const options = injectableDec?.arguments[0] || {};
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

      // 4. Process Explicit Providers from __module__.ts (Overrides)
      if (rawDef && rawDef.providers) {
        rawDef.providers.forEach((p: any) => {
          if (p.__bunner_spread) {
            node.dynamicProviderBundles.add(p.__bunner_spread);

            return;
          }

          const ref = this.normalizeProvider(p);

          // Check uniqueness/ambiguity
          if (node.providers.has(ref.token) && !this.isImplicit(node.providers.get(ref.token))) {
            throw new Error(
              `[Bunner AOT] Ambiguous provider '${ref.token}' in module '${node.name}' (${node.filePath}). Duplicate explicit definition.`,
            );
          }

          // If we are overwriting an implicit provider with a simple Reference (Identifier),
          // we must preserve the rich ClassMetadata (constructor params) found during discovery.
          if (node.providers.has(ref.token)) {
            const prev = node.providers.get(ref.token);

            if (this.isImplicit(prev)) {
              // If the explicit one is just an identifier/ref
              if (ref.metadata && (ref.metadata.__bunner_ref || typeof ref.metadata === 'function')) {
                ref.metadata = prev?.metadata;
                ref.filePath = prev?.filePath;

                // Also need to preserve scope if explicit didn't specify?
                // Explicit simple ref implies same class, so decorator options apply.
                if (!ref.scope) {
                  ref.scope = prev?.scope;
                }

                // Inherit visibility from decorator
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

    // 5. Link imports? (No, modules don't import modules in Plan. They import visibility-checked providers)

    // 6. Validation
    this.validateVisibilityAndScope();

    return this.modules;
  }

  detectCycles(): CyclePath[] {
    // TODO: Implement Cycle Detection based on Dependency Graph
    return [];
  }

  resolveToken(_moduleName: string, _token: string): string | null {
    // Not used in the same way anymore, as we don't have "Module Import" edges.
    // We search globally or via explicit configuration?
    // PLAN: "Module A component injects Module B component"
    // How does A know about B?
    // "Auto-discovery"?
    // If code uses `import { BService } from '../b/b.service'`, it refers to the class.
    // We map Class -> Module.
    // So we check ClassMap.
    return null;
  }

  private isImplicit(ref: ProviderRef | undefined): boolean {
    // Logic to determine if ref was added implicitly
    // We can add a flag to ProviderRef or check metadata structure
    return !!(ref?.metadata && ref.metadata.className); // Rough check
  }

  private validateVisibilityAndScope() {
    this.modules.forEach(node => {
      // Iterate all providers in this module
      node.providers.forEach(provider => {
        // Analyze dependencies (constructor params / injects)
        if (!provider.metadata) {
          return;
        }

        const deps = this.extractDeps(provider);

        deps.forEach(depToken => {
          const targetModule = this.classMap.get(depToken); // Assuming token is ClassName

          if (!targetModule) {
            // Maybe token is string/symbol?
            // If so, we need to find which module provides it.
            // This implies a Global Search for token?
            // Or it must be provided in the SAME module explicitly?
            // PLAN: "모듈 간 결합은 인스턴스(클래스) 단위 공개(visibility)로 제어"
            // "대상이 visibility: exported가 아니면 빌드 실패"
            return;
          }

          if (targetModule === node) {
            return;
          } // Intra-module is always allowed

          // Cross-module access
          const targetProvider = targetModule.providers.get(depToken);

          if (!targetProvider) {
            // Token not found in target module
            return;
          }

          // 1. Visibility Check
          if (!targetProvider.isExported) {
            throw new Error(
              `[Bunner AOT] Visibility Violation: '${provider.token}' in module '${node.name}' tries to inject '${depToken}' from '${targetModule.name}', but it is NOT exported.`,
            );
          }

          // 2. Scope Check
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
    // Helper to extract dependency tokens from constructor or inject array
    if (!provider.metadata) {
      return [];
    }

    // If ClassMetadata
    if (provider.metadata.constructorParams) {
      return provider.metadata.constructorParams.map((p: any) => {
        // Logic to extract token name (handling @Inject)
        // Simplified for brevity
        const injectDec = p.decorators?.find((d: any) => d.name === 'Inject');

        if (injectDec && injectDec.arguments[0]) {
          return injectDec.arguments[0];
        } // TODO: Handle Symbol/String correctly

        if (p.type && p.type.__bunner_ref) {
          return p.type.__bunner_ref;
        }

        return p.type;
      });
    }

    // If useFactory
    if (provider.metadata.inject) {
      return provider.metadata.inject;
    }

    return [];
  }

  private normalizeProvider(p: any): ProviderRef {
    // Reuse logic from previous one but ensure it captures scope/visibility if possible (from where in raw def?)
    // Raw def in __module__.ts providers array typically doesn't have visibility/scope options attached directly
    // unless we support extended syntax there or it inherits from Class.
    // For useClass, we look up the class metadata!

    let token = 'UNKNOWN';
    const isExported = false; // Default for explicit?
    const scope = 'singleton';

    if (p.provide) {
      token = this.extractTokenName(p.provide);
    } else if (typeof p === 'function') {
      token = p.name;
    } else if (p.__bunner_ref) {
      token = p.__bunner_ref;
    }

    // Look up class metadata for visibility/scope if useClass or ClassProvider
    let clsName = null;

    if (typeof p === 'function') {
      clsName = p.name;
    }

    if (p.__bunner_ref) {
      clsName = p.__bunner_ref;
    }

    if (p.useClass) {
      clsName = this.extractTokenName(p.useClass);
    }

    if (clsName) {
      // We might fail lookup if we don't have handle to classMap here...
      // But we are inside ModuleGraph class, we have access to this.classMap (partially built)
      // Actually we fill classMap in Discovery phase (step 3).
      // Step 4 runs after Step 3. So classMap is populated.
      // BUT strict lookup by string might be flaky if multiple classes have same name.
      // We should use Import matching.
    }

    return { token, metadata: p, isExported, scope };
  }

  private extractTokenName(t: any): string {
    if (typeof t === 'string') {
      return t;
    }

    if (typeof t === 'function') {
      return t.name;
    }

    if (t.__bunner_ref) {
      return t.__bunner_ref;
    }

    if (typeof t === 'symbol') {
      return t.description || t.toString();
    }

    return 'UNKNOWN';
  }
}
