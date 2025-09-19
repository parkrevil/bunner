import type { Class } from '../common/types';
import { Container } from '../injector';

import type { BaseModule } from './interfaces';

export abstract class BaseApplication<O = any> {
  protected readonly rootModule: BaseModule;
  protected readonly container: Container;
  protected options: Required<O>;

  constructor(rootModule: Class<BaseModule>) {
    this.rootModule = new rootModule();
    this.container = new Container(rootModule);
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

  /**
   * Initialize the application
   * @returns
   */
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
}
