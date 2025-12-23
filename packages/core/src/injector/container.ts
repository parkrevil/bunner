export type FactoryFn<T = any> = (container: Container) => T;
export type Token = any;

export class Container {
  private factories = new Map<Token, FactoryFn>();
  private instances = new Map<Token, any>();

  constructor(initialFactories?: Map<Token, FactoryFn>) {
    if (initialFactories) {
      this.factories = initialFactories;
    }
  }

  set(token: Token, factory: FactoryFn) {
    this.factories.set(token, factory);
  }

  get<T = any>(token: Token): T {
    if (this.instances.has(token)) {
      return this.instances.get(token);
    }

    const factory = this.factories.get(token);
    if (!factory) {
      throw new Error(`No provider for token: ${token.name || token}`);
    }

    const instance = factory(this);
    this.instances.set(token, instance);

    return instance;
  }

  keys() {
    return this.factories.keys();
  }

  has(token: Token): boolean {
    return this.factories.has(token);
  }

  getInstances(): IterableIterator<any> {
    return this.instances.values();
  }

  async loadDynamicModule(scope: string, dynamicModule: any) {
    if (!dynamicModule) {
      return;
    }
    await Promise.resolve();

    const providers = dynamicModule.providers || [];

    for (const p of providers) {
      let token: any;
      let factory: FactoryFn | undefined;

      if (typeof p === 'function') {
        token = p;
        factory = c => new p(...this.resolveDepsFor(p, scope, c));
      } else if (p.provide) {
        token = p.provide;
        if (p.useValue) {
          factory = () => p.useValue;
        } else if (p.useFactory) {
          factory = async c => {
            const args = (p.inject || []).map((t: any) => c.get(t));
            return await p.useFactory(...args);
          };
        } else {
          factory = () => null;
        }
      }

      let keyStr = '';
      if (typeof token === 'string') {
        keyStr = `${scope}::${token}`;
      } else if (token.name) {
        keyStr = `${scope}::${token.name}`;
      }

      if (keyStr && factory) {
        this.set(keyStr, factory);
      }
    }
  }

  private resolveDepsFor(ctor: any, scope: string, _c: Container): any[] {
    const registry = (globalThis as any).__BUNNER_METADATA_REGISTRY__;
    if (!registry || !registry.has(ctor)) {
      return [];
    }

    const meta = registry.get(ctor);
    if (!meta.constructorParams) {
      return [];
    }

    return meta.constructorParams.map((param: any) => {
      let token = param.type;

      const injectDec = param.decorators?.find((d: any) => d.name === 'Inject');
      if (injectDec && injectDec.arguments?.length > 0) {
        token = injectDec.arguments[0];
      }

      const key = `${scope}::${token}`;

      try {
        return this.get(key);
      } catch (_e) {
        try {
          return this.get(token);
        } catch (_e2) {
          return undefined;
        }
      }
    });
  }
}
