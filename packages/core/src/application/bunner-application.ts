import type {
  BunnerAdapter,
  Context,
  OnInit,
  BeforeStart,
  OnStart,
  OnShutdown,
  OnDestroy,
  AdapterCollection,
  Configurer,
  AdapterConfig,
  AdapterInstanceConfig,
} from '@bunner/common';
import { Logger } from '@bunner/logger';

import { Container } from '../injector/container';
import { BunnerScanner } from '../injector/scanner';

export class BunnerApplication {
  private readonly adapters: Map<string, Map<string, BunnerAdapter>> = new Map();
  private readonly container: Container;
  private isInitialized = false;

  constructor(
    private readonly entryModule: unknown,
    private readonly _options: any = {},
  ) {
    const providedContainer = this._options?.container as Container | undefined;

    this.container = providedContainer ?? new Container();

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
    this.applyAdapterConfig(protocol, name, adapter);

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

    const scanner = new BunnerScanner(this.container);

    if (Array.isArray(this._options.providers) && this._options.providers.length > 0) {
      await scanner.scan({ providers: this._options.providers });
    }

    if (!this._options.skipScanning) {
      await scanner.scan(this.entryModule);
    }

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
    const context: Context & { entryModule: unknown } = {
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

  private applyAdapterConfig(protocol: string, instanceName: string, adapter: unknown): void {
    const rawConfig =
      (this._options?.adapterConfig as AdapterConfig | undefined) ??
      ((this.entryModule as any)?.adapters as AdapterConfig | undefined);

    if (!rawConfig) {
      return;
    }

    const protocolConfig = rawConfig[protocol];

    if (!protocolConfig) {
      return;
    }

    const wildcard = protocolConfig['*'] as AdapterInstanceConfig | undefined;
    const specific = protocolConfig[instanceName] as AdapterInstanceConfig | undefined;
    const middlewares = this.mergeMiddlewares(wildcard?.middlewares, specific?.middlewares);
    const errorFilters = [...(wildcard?.errorFilters ?? []), ...(specific?.errorFilters ?? [])];
    const adapterAny = adapter as any;

    if (middlewares && typeof adapterAny.addMiddlewares === 'function') {
      Object.entries(middlewares).forEach(([lifecycle, items]) => {
        if (!Array.isArray(items) || items.length === 0) {
          return;
        }

        adapterAny.addMiddlewares(lifecycle, items);
      });
    }

    if (errorFilters.length > 0 && typeof adapterAny.addErrorFilters === 'function') {
      adapterAny.addErrorFilters(errorFilters);
    }
  }

  private mergeMiddlewares(
    wildcard: AdapterInstanceConfig['middlewares'] | undefined,
    specific: AdapterInstanceConfig['middlewares'] | undefined,
  ): Record<string, readonly unknown[]> | undefined {
    const result: Record<string, readonly unknown[]> = {};

    if (wildcard) {
      Object.entries(wildcard).forEach(([lifecycle, items]) => {
        if (!Array.isArray(items) || items.length === 0) {
          return;
        }

        result[lifecycle] = [...items];
      });
    }

    if (specific) {
      Object.entries(specific).forEach(([lifecycle, items]) => {
        if (!Array.isArray(items) || items.length === 0) {
          return;
        }

        const prev = result[lifecycle] ?? [];

        result[lifecycle] = [...prev, ...items];
      });
    }

    if (Object.keys(result).length === 0) {
      return undefined;
    }

    return result;
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
