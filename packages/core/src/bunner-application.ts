import { Container } from './injector';
import type { BunnerRootModule } from './interfaces';
import type { Class } from './types';

export abstract class BunnerApplication {
  private rootModule: BunnerRootModule;
  private container: Container;

  constructor(rootModule: Class<BunnerRootModule>) {
    this.rootModule = new rootModule();
    this.container = new Container(rootModule);
  }

  async init() {
    await this.container.init();
  }

  /**
   * Bootstrap the application
   * @param moduleConstructor - The module constructor
   */
  async bootstrap() {
    console.log('🚀 Application is booting...');

    await this.rootModule.configure?.(this);
    await this.rootModule.registerMiddlewares?.(this);

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
