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
}
