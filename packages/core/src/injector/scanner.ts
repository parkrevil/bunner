import type { Class } from '@bunner/common';

import type { Container } from './container';
import type { ModuleMetadata } from './types';

export class BunnerScanner {
  constructor(
    private readonly container: Container,
    private readonly registry?: Map<any, any>,
  ) {}

  public async scan(module: unknown): Promise<void> {
    const visited = new Set<unknown>();

    await this.scanModule(module, visited);
  }

  private async scanModule(moduleOrDynamic: any, visited: Set<unknown>) {
    if (!moduleOrDynamic) {
      return;
    }

    if (visited.has(moduleOrDynamic)) {
      return;
    }

    visited.add(moduleOrDynamic);

    if (typeof moduleOrDynamic !== 'function') {
      await this.scanModuleObject(moduleOrDynamic, visited);

      return;
    }

    const moduleClass: Class = moduleOrDynamic;

    this.registerProvider(moduleClass);

    const registry = this.registry ?? (globalThis as any).__BUNNER_METADATA_REGISTRY__;

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
      } else if (provider.useExisting) {
        factory = (c: Container) => c.get(provider.useExisting);
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
    const registry = this.registry ?? (globalThis as any).__BUNNER_METADATA_REGISTRY__;
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

  private async scanModuleObject(moduleObj: any, visited: Set<unknown>): Promise<void> {
    const providers = Array.isArray(moduleObj.providers) ? moduleObj.providers : [];
    const controllers = Array.isArray(moduleObj.controllers) ? moduleObj.controllers : [];
    const imports = Array.isArray(moduleObj.imports) ? moduleObj.imports : [];

    for (const provider of providers) {
      this.registerProvider(provider);
    }

    for (const controller of controllers) {
      this.registerProvider(controller);
    }

    for (const imported of imports) {
      await this.scanModule(imported, visited);
    }
  }
}
