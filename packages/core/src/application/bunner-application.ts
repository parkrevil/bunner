import type { BunnerAdapter, Context, OnModuleInit, OnApplicationBootstrap, OnApplicationShutdown, Class } from '@bunner/common';
import { Logger } from '@bunner/logger';

import { Container } from '../injector/container';
import { BunnerScanner } from '../injector/scanner'; // Import Scanner

export class BunnerApplication {
  private readonly adapters: BunnerAdapter[] = [];
  private readonly container: Container;

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
    // Initialize container (module scanning)
    const scanner = new BunnerScanner(this.container);
    await scanner.scan(this.entryModule);

    // Eager Load: Instantiate all providers to trigger lifecycle hooks
    // This mimics NestJS behavior where singletons are created on bootstrap
    for (const token of this.container.keys()) {
      try {
        this.container.get(token);
      } catch (e) {
        console.warn(`Failed to instantiate provider during init: ${String(token)}`, e);
      }
    }

    // Lifecycle: OnModuleInit
    await this.callLifecycleHook('onModuleInit');

    return this;
  }

  public async start(): Promise<void> {
    // Lifecycle: OnApplicationBootstrap
    await this.callLifecycleHook('onApplicationBootstrap');

    // Create base context
    const context: Context & { entryModule: Class } = {
      getType: () => 'bunner',
      get: (key: string) => this.container.get(key),
      container: this.container,
      entryModule: this.entryModule,
    } as any;

    await Promise.all(this.adapters.map(adapter => adapter.start(context)));
  }

  public async stop(): Promise<void> {
    await Promise.all(this.adapters.map(adapter => adapter.stop()));

    // Lifecycle: OnApplicationShutdown
    await this.callLifecycleHook('onApplicationShutdown');
  }

  private async callLifecycleHook(
    method: keyof (OnModuleInit & OnApplicationBootstrap & OnApplicationShutdown),
    args: any[] = [],
  ) {
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
