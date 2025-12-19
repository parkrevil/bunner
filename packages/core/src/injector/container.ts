export type FactoryFn<T = any> = (container: Container) => T;
export type Token = any; // Constructor or String

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
    // 1. Check Instance Cache
    if (this.instances.has(token)) {
      return this.instances.get(token);
    }

    // 2. Check Factory
    const factory = this.factories.get(token);
    if (!factory) {
      throw new Error(`No provider for token: ${token.name || token}`);
    }

    // 3. Create Instance (Lazy)
    // We pass 'this' (container) so the factory can resolve deps recursively
    const instance = factory(this);
    this.instances.set(token, instance);

    return instance;
  }

  keys() {
    return this.factories.keys();
  }

  async loadDynamicModule(scope: string, dynamicModule: any) {
    if (!dynamicModule) {
      return;
    }
    await Promise.resolve();

    const providers = dynamicModule.providers || [];
    // Normalize providers
    for (const p of providers) {
      let token: any;
      let factory: FactoryFn | undefined;

      if (typeof p === 'function') {
        // Class provider
        token = p;
        factory = c => new p(...this.resolveDepsFor(p, scope, c));
      } else if (p.provide) {
        token = p.provide;
        if (p.useValue) {
          factory = () => p.useValue;
        } else if (p.useFactory) {
          // This relies on useFactory being executable
          factory = async c => {
            const args = (p.inject || []).map((t: any) => c.get(t));
            return await p.useFactory(...args);
          };
        } else {
          factory = () => null; // Unsupported
        }
      }

      // Register with Scoped Key
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

  // Helper for dynamic instantiation (Runtime Reflection fallback if needed)
  private resolveDepsFor(_ctor: any, _scope: string, _c: Container): any[] {
    return []; // Placeholder. Dynamic modules often imply manual setup or standard injection
  }
}
