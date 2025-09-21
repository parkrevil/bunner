import type { BunnerApplicationBaseOptions } from './interfaces';

export abstract class BaseApplication<O = any> {
  protected options: O & Required<BunnerApplicationBaseOptions>;

  /**
   * Start the application
   * @param options - The options
   */
  abstract start(options?: any): void | Promise<void>;

  /**
   * Shutdown the application
   * @param force - Whether to force shutdown the application
   */
  abstract shutdown(force?: boolean): void | Promise<void>;

  /**
   * Initialize the application
   * @returns
   */
  abstract init(): void | Promise<void>;
}
