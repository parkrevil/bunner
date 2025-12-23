import type { BunnerAdapter, Context, OnInit, BeforeStart, OnStart, OnShutdown, OnDestroy, Class } from '@bunner/common';
import { Logger } from '@bunner/logger';

import { Container } from '../injector/container';
import { BunnerScanner } from '../injector/scanner'; // Import Scanner

export class BunnerApplication {
  private readonly adapters: BunnerAdapter[] = [];
  private readonly container: Container;
  private isInitialized = false;

  constructor(
    private readonly entryModule: Class,
    _options: any = {},
  ) {
    this.container = new Container();
    this.container.set(Logger, () => new Logger('App'));
  }

  public addAdapter(adapter: BunnerAdapter): this {
    this.adapters.push(adapter);
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

    // Lifecycle: Init
    await this.callLifecycleHook('onInit');

    return this;
  }

  public async start(): Promise<void> {
    // Lifecycle: Pre-Start
    await this.callLifecycleHook('beforeStart');

    // Create base context
    const context: Context & { entryModule: Class } = {
      getType: () => 'bunner',
      get: (key: string) => this.container.get(key),
      container: this.container,
      entryModule: this.entryModule,
    } as any;

    await Promise.all(this.adapters.map(adapter => adapter.start(context)));

    // Lifecycle: Post-Start
    await this.callLifecycleHook('onStart');
  }

  public async stop(): Promise<void> {
    // Lifecycle: Pre-Shutdown
    await this.callLifecycleHook('onShutdown');

    await Promise.all(this.adapters.map(adapter => adapter.stop()));

    // Lifecycle: Destruction
    await this.callLifecycleHook('onDestroy');
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
