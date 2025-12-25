import type {
  BunnerAdapter,
  Context,
  OnInit,
  BeforeStart,
  OnStart,
  OnShutdown,
  OnDestroy,
  Class,
  AdapterCollection,
  Configurer,
} from '@bunner/common';
import { Logger } from '@bunner/logger';

import { Container } from '../injector/container';
import { BunnerScanner } from '../injector/scanner';

export class BunnerApplication {
  private readonly adapters: Map<string, Map<string, BunnerAdapter>> = new Map();
  private readonly container: Container;
  private isInitialized = false;

  constructor(
    private readonly entryModule: Class,
    _options: any = {},
  ) {
    const globalRef = globalThis as any;

    if (globalRef.__BUNNER_CONTAINER__) {
      this.container = globalRef.__BUNNER_CONTAINER__;
    } else {
      this.container = new Container();

      globalRef.__BUNNER_CONTAINER__ = this.container;
    }

    // Ensure Logger is set if not already
    if (!this.container.has(Logger)) {
      this.container.set(Logger, () => new Logger('App'));
    }
  }

  public addAdapter(adapter: BunnerAdapter, options: { name?: string; protocol?: string } = {}): this {
    const protocol = options.protocol || 'http';
    const name = options.name || `adapter_${Math.random().toString(36).substr(2, 9)}`;

    if (!this.adapters.has(protocol)) {
      this.adapters.set(protocol, new Map());
    }

    this.adapters.get(protocol)!.set(name, adapter);

    return this;
  }

  public getContainer(): Container {
    return this.container;
  }

  public async init(): Promise<this> {
    if (this.isInitialized) {
      return this;
    }

    this.isInitialized = true;

    // Initialize container (module scanning)
    const scanner = new BunnerScanner(this.container);

    await scanner.scan(this.entryModule);

    // Eager Load: Instantiate all providers to trigger lifecycle hooks
    for (const token of this.container.keys()) {
      try {
        this.container.get(token);
      } catch (e) {
        console.warn(`Failed to instantiate provider during init: ${String(token)}`, e);
      }
    }

    // Configure Adapters via Modules
    const adapterCollection = this.createAdapterCollection();
    const instances = this.container.getInstances();

    for (const instance of instances) {
      if (this.isConfigurer(instance)) {
        instance.configure(this, adapterCollection);
      }
    }

    // Lifecycle: Init
    await this.callLifecycleHook('onInit');

    return this;
  }

  public async start(): Promise<void> {
    if (!this.isInitialized) {
      await this.init();
    }

    // Lifecycle: Pre-Start
    await this.callLifecycleHook('beforeStart');

    // Create base context
    const context: Context & { entryModule: Class } = {
      getType: () => 'bunner',
      get: (key: string) => this.container.get(key),
      container: this.container,
      entryModule: this.entryModule,
    } as any;
    const allAdapters = this.getAllAdapters();

    await Promise.all(allAdapters.map(adapter => adapter.start(context)));
    // Lifecycle: Post-Start
    await this.callLifecycleHook('onStart');
  }

  public async stop(): Promise<void> {
    // Lifecycle: Pre-Shutdown
    await this.callLifecycleHook('onShutdown');

    const allAdapters = this.getAllAdapters();

    await Promise.all(allAdapters.map(adapter => adapter.stop()));
    // Lifecycle: Destruction
    await this.callLifecycleHook('onDestroy');
  }

  private getAllAdapters(): BunnerAdapter[] {
    const adapters: BunnerAdapter[] = [];

    this.adapters.forEach(protocolMap => {
      protocolMap.forEach(adapter => adapters.push(adapter));
    });

    return adapters;
  }

  private createAdapterCollection(): AdapterCollection {
    const collection: AdapterCollection = {};

    this.adapters.forEach((groupApi, protocol) => {
      collection[protocol] = {
        get: (name: string) => groupApi.get(name),
        all: () => Array.from(groupApi.values()),
        forEach: cb => groupApi.forEach(cb),
      };
    });

    return collection;
  }

  private isConfigurer(instance: any): instance is Configurer {
    return instance && typeof (instance as Configurer).configure === 'function';
  }

  private async callLifecycleHook(method: keyof (OnInit & BeforeStart & OnStart & OnShutdown & OnDestroy), args: any[] = []) {
    const instances = this.container.getInstances();

    for (const instance of instances) {
      if (instance && typeof instance[method] === 'function') {
        try {
          // await (instance as any)[method](...args);
          await instance[method](...args);
        } catch (e) {
          console.error(`Lifecycle hook ${method} failed`, e);
        }
      }
    }
  }
}
