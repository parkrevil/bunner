import type { ClassType } from './types';

export abstract class BunnerApplication {
  /**
   * Initialize modules/resources and wait until all onModuleInit hooks complete.
   * Apps should call this after registering modules and before starting servers.
   */
  async bootstrap(module: ClassType) {
    console.log('🚀 Application is booting...');

    console.log('🚀 Application is ready.');
  }

  /**
   * Graceful shutdown; wait until all onApplicationShutdown hooks complete.
   */
  async shutdown() {
    await this.stop(true);
  }

  abstract start(options?: any): void | Promise<void>;
  abstract stop(force?: boolean): void | Promise<void>;
}
