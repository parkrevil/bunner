import type { BunnerApplicationBaseOptions } from './interfaces';

export abstract class BaseApplication<O = any> {
  protected options: Required<O & BunnerApplicationBaseOptions>;

  abstract start(options?: any): void | Promise<void>;

  abstract shutdown(force?: boolean): void | Promise<void>;

  abstract init(): void | Promise<void>;
}