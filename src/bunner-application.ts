import { AppContainer } from './core/injector';
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
    this.container.registerModule(module);

    const { modules, providers, controllers } = await this.container.loadAndGetAll();

    console.log('modules', modules);
    console.log('providers', providers);
    console.log('controllers', controllers);

    await Promise.all([
      Promise.all(modules.map(m => m.onModuleInit?.())),
      Promise.all(providers.map(p => p.onModuleInit?.())),
      Promise.all(controllers.map(c => c.onModuleInit?.())),
    ]);

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
