import type { BunnerRootModule } from './interfaces';
import type { Class } from './types';

export abstract class BunnerApplication {
  /**
   * Bootstrap the application
   * @param moduleConstructor - The module constructor
   */
  async bootstrap(moduleConstructor: Class<BunnerRootModule>) {
    console.log('🚀 Application is booting...');

    const module = new moduleConstructor();
    await module.configure?.();
    await module.registerMiddlewares?.();

    console.log('🚀 Application is ready.');
  }

  /**
   * Start the application
   * @param options - The options
   */
  abstract start(options?: any): void | Promise<void>;

  /**
   * Stop the application
   * @param force - Whether to force stop the application
   */
  abstract stop(force?: boolean): void | Promise<void>;
}
