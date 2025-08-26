import { AppContainer } from './core/injector';
import type { OnModuleInit } from './interfaces';
import type { ClassType } from './types';

export abstract class BunnerApplication {
  readonly container: AppContainer;

  constructor() {
    this.container = new AppContainer();
  }

  /**
   * Initialize modules/resources and wait until all onModuleInit hooks complete.
   * Apps should call this after registering modules and before starting servers.
   */
  async bootstrap(module: ClassType) {
    await this.container.registerModule(module);

    const { providers, controllers } = await this.container.loadAndGetAllNonRequest();

    await Promise.all(
      ([] as any[]).concat(providers, controllers).map((m) => (m as OnModuleInit).onModuleInit?.())
    );

    console.log('🚀 All modules/providers/controllers initialized.');
  }

  /**
   * Graceful shutdown; wait until all onApplicationShutdown hooks complete.
   */
  async teardown() {
  }

  abstract start(options?: any): void | Promise<void>;
  abstract shutdown(force?: boolean): void | Promise<void>;
}
