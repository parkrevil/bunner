import type { Class } from '@bunner/common';

import type { Container } from './container';
import type { ModuleMetadata } from './types';

export class BunnerScanner {
  constructor(private readonly container: Container) {}

  public async scan(module: Class): Promise<void> {
    await this.scanModule(module);
  }

  private async scanModule(moduleOrDynamic: any, visited: Set<Class> = new Set()) {
    let moduleClass: Class;
    let dynamicMetadata: any = {};

    if (moduleOrDynamic && moduleOrDynamic.module) {
      moduleClass = moduleOrDynamic.module;
      dynamicMetadata = moduleOrDynamic;
    } else {
      moduleClass = moduleOrDynamic;
    }

    if (!moduleClass) {
      console.warn('[Scanner] Skipping undefined module. Check for circular dependencies.');

      return;
    }

    if (visited.has(moduleClass)) {
      return;
    }

    visited.add(moduleClass);
    // Register the Module itself so it can be injected and have lifecycle hooks
    // Try/Catch in case it's a dynamic module object without constructor?
    // moduleClass is the Class constructor.
    this.registerProvider(moduleClass);

    // Register Dynamic Module Providers/Controllers FIRST
    if (dynamicMetadata.providers) {
      for (const provider of dynamicMetadata.providers) {
        this.registerProvider(provider);
      }
    }

    if (dynamicMetadata.controllers) {
      for (const controller of dynamicMetadata.controllers) {
        this.registerProvider(controller);
      }
    }

    if (dynamicMetadata.imports) {
      for (const imported of dynamicMetadata.imports) {
        await this.scanModule(imported, visited);
      }
    }

    const registry = (globalThis as any).__BUNNER_METADATA_REGISTRY__;

    if (!registry || !registry.has(moduleClass)) {
      return;
    }

    const meta = registry.get(moduleClass);
    const moduleDec = (meta.decorators || []).find((d: any) => d.name === 'Module');

    if (!moduleDec) {
      return;
    }

    const options: ModuleMetadata = moduleDec.arguments[0] || {};

    // 1. Scan Imports (Recursive)
    if (options.imports) {
      for (const imported of options.imports) {
        await this.scanModule(imported, visited);
      }
    }

    // 2. Register Providers
    if (options.providers) {
      for (const provider of options.providers) {
        this.registerProvider(provider);
      }
    }

    // 3. Register Controllers (as providers, so they can be injected/resolved)
    if (options.controllers) {
      for (const controller of options.controllers) {
        this.registerProvider(controller);
      }
    }
  }

  private registerProvider(provider: any) {
    let token: any;
    let factory: any; // FactoryFn in container

    if (typeof provider === 'function') {
      token = provider;
      // Factory that constructs class with Dependencies
      factory = (c: Container) => new provider(...this.resolveDepsFor(provider, c));
    } else if (provider.provide) {
      token = provider.provide;

      if (provider.useValue) {
        factory = () => provider.useValue;
      } else if (provider.useFactory) {
        factory = (c: Container) => {
          // Resolve inject deps
          const args = (provider.inject || []).map((t: any) => c.get(t));

          return provider.useFactory(...args);
        };
      } else if (provider.useClass) {
        factory = (c: Container) => new provider.useClass(...this.resolveDepsFor(provider.useClass, c));
      } else {
        factory = () => null;
      }
    }

    if (token && factory) {
      this.container.set(token, factory);
    } else {
      console.warn(`[Scanner] Failed to register provider: ${provider}`);
    }
  }

  // Duplicate logic from Container.resolveDepsFor but adapted?
  // Container.resolveDepsFor was private. I can't access it.
  // I must implement it here or expose it in Container.
  // Implementing here is fine.
  private resolveDepsFor(ctor: any, c: Container): any[] {
    const registry = (globalThis as any).__BUNNER_METADATA_REGISTRY__;
    const scopedKeys = (globalThis as any).__BUNNER_SCOPED_KEYS__ as Map<any, string> | undefined;

    if (!registry || !registry.has(ctor)) {
      return [];
    }

    const meta = registry.get(ctor);

    if (!meta.constructorParams) {
      return [];
    }

    return meta.constructorParams.map((param: any) => {
      let token = param.type;

      if (token && typeof token === 'object') {
        if (token.__bunner_ref) {
          token = token.__bunner_ref;
        } else if (token.__bunner_forward_ref) {
          token = token.__bunner_forward_ref;
        }
      }

      const injectDec = param.decorators?.find((d: any) => d.name === 'Inject');

      if (injectDec && injectDec.arguments?.length > 0) {
        token = injectDec.arguments[0];

        if (token && typeof token === 'object') {
          if (token.__bunner_forward_ref) {
            token = token.__bunner_forward_ref;
          } else if (token.__bunner_ref) {
            token = token.__bunner_ref;
          }
        }
      }

      const normalizedToken = this.normalizeToken(token);
      const scopedKey = scopedKeys?.get(token) || (normalizedToken ? scopedKeys?.get(normalizedToken) : undefined);

      if (scopedKey) {
        try {
          return c.get(scopedKey);
        } catch (_e) {
          console.warn(`[Scanner] Failed to resolve dependency for ${ctor.name}. Token: ${normalizedToken ?? String(token)}`);

          return undefined;
        }
      }

      // Try get from container directly
      try {
        const instance = c.get(normalizedToken ?? token);

        return instance;
      } catch (_e) {
        console.warn(`[Scanner] Failed to resolve dependency for ${ctor.name}. Token: ${normalizedToken ?? String(token)}`);

        return undefined;
      }
    });
  }

  private normalizeToken(token: any): string | undefined {
    if (!token) {
      return undefined;
    }

    if (typeof token === 'string') {
      return token;
    }

    if (typeof token === 'function' && token.name) {
      return token.name;
    }

    if (typeof token === 'object') {
      if (token.__bunner_ref) {
        return token.__bunner_ref;
      }

      if (token.__bunner_forward_ref) {
        return token.__bunner_forward_ref;
      }

      if (typeof token.name === 'string') {
        return token.name;
      }
    }

    return undefined;
  }
}
