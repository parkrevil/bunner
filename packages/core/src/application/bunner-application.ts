import type {
  AdapterCollection,
  AdapterConfig,
  AdapterInstanceConfig,
  BunnerAdapter,
  Class,
  Configurer,
  MiddlewareConfig,
  OnDestroy,
  OnInit,
  OnShutdown,
  OnStart,
  BeforeStart,
} from '@bunner/common';

import { Logger } from '@bunner/logger';

import { Container } from '../injector/container';
import { BunnerScanner } from '../injector/scanner';
import type { ContainerValue } from '../injector/types';
import type {
  AdapterRegistrationOptions,
  BunnerApplicationContext,
  BunnerApplicationRuntimeOptions,
  ConfigurableAdapter,
  BunnerModule,
} from './interfaces';
import type { EntryModule, LifecycleHookMethod } from './types';

export class BunnerApplication {
  private readonly adapters: Map<string, Map<string, BunnerAdapter>> = new Map();
  private readonly container: Container;
  private isInitialized = false;

  constructor(
    private readonly entryModule: EntryModule,
    private readonly _options: BunnerApplicationRuntimeOptions = {},
  ) {
    const providedContainer = this._options.container;

    this.container = providedContainer ?? new Container();

    // Ensure Logger is set if not already
    if (!this.container.has(Logger)) {
      this.container.set(Logger, () => new Logger('App'));
    }
  }

  public addAdapter(adapter: BunnerAdapter, options: AdapterRegistrationOptions = {}): this {
    const protocol = options.protocol ?? 'http';
    const name = options.name ?? `adapter_${Math.random().toString(36).substr(2, 9)}`;

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
    const context: BunnerApplicationContext = {
      getType: () => 'bunner',
      get: (key: string) => this.container.get(key),
      to: <TContext>(ctor: Class<TContext>) => this.container.get(ctor) as TContext,
      container: this.container,
      entryModule: this.entryModule,
    };
    const allAdapters = this.getAllAdapters();

    await Promise.all(allAdapters.map(async adapter => adapter.start(context)));
    // Lifecycle: Post-Start
    await this.callLifecycleHook('onStart');
  }

  public async stop(): Promise<void> {
    // Lifecycle: Pre-Shutdown
    await this.callLifecycleHook('onShutdown');

    const allAdapters = this.getAllAdapters();

    await Promise.all(allAdapters.map(async adapter => adapter.stop()));
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

  private applyAdapterConfig(protocol: string, instanceName: string, adapter: BunnerAdapter): void {
    const rawConfig =
      this._options.adapterConfig ?? this.getEntryModuleAdapterConfig();

    if (!rawConfig) {
      return;
    }

    const protocolConfig = rawConfig[protocol];

    if (!protocolConfig) {
      return;
    }

    const wildcard = protocolConfig['*'];
    const specific = protocolConfig[instanceName];
    const middlewares = this.mergeMiddlewares(wildcard?.middlewares, specific?.middlewares);
    const errorFilters = [...(wildcard?.errorFilters ?? []), ...(specific?.errorFilters ?? [])];
    const configurableAdapter = adapter as ConfigurableAdapter;

    if (middlewares && typeof configurableAdapter.addMiddlewares === 'function') {
      Object.entries(middlewares).forEach(([lifecycle, items]) => {
        if (!Array.isArray(items) || items.length === 0) {
          return;
        }

        configurableAdapter.addMiddlewares(lifecycle, items);
      });
    }

    if (errorFilters.length > 0 && typeof configurableAdapter.addErrorFilters === 'function') {
      configurableAdapter.addErrorFilters(errorFilters);
    }
  }

  private mergeMiddlewares(
    wildcard: AdapterInstanceConfig['middlewares'] | undefined,
    specific: AdapterInstanceConfig['middlewares'] | undefined,
  ): MiddlewareConfig | undefined {
    const result: MiddlewareConfig = {};

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
        forEach: cb => {
          groupApi.forEach(cb);
        },
      };
    });

    return collection;
  }

  private async callLifecycleHook(method: LifecycleHookMethod): Promise<void> {
    const instances = this.container.getInstances();

    for (const instance of instances) {
      if (this.isLifecycleTarget(instance, method)) {
        try {
          await instance[method]();
        } catch (e) {
          console.error(`Lifecycle hook ${method} failed`, e);
        }
      }
    }
  }

  private getEntryModuleAdapterConfig(): AdapterConfig | undefined {
    if (!this.isAdapterConfiguredModule(this.entryModule)) {
      return undefined;
    }

    return this.entryModule.adapters;
  }

  private isConfigurer(instance: ContainerValue): instance is Configurer {
    return Boolean(instance) && typeof (instance as Configurer).configure === 'function';
  }

  private isLifecycleTarget(instance: ContainerValue, method: LifecycleHookMethod): instance is OnInit &
    BeforeStart & OnStart & OnShutdown & OnDestroy {
    if (typeof instance !== 'object' && typeof instance !== 'function') {
      return false;
    }

    if (instance === null) {
      return false;
    }

    return typeof (instance as OnInit & BeforeStart & OnStart & OnShutdown & OnDestroy)[method] === 'function';
  }

  private isAdapterConfiguredModule(module: EntryModule): module is BunnerModule {
    if (typeof module !== 'object' && typeof module !== 'function') {
      return false;
    }

    if (module === null) {
      return false;
    }

    return 'adapters' in module;
  }
}
