import type { Context } from './interfaces';
import type { Class } from './types';
import type { MiddlewareRegistration } from './interfaces';

export abstract class BunnerMiddleware<TOptions = void> {
  public static withOptions<TOptions>(
    this: Class<BunnerMiddleware<TOptions>>,
    options: TOptions,
  ): MiddlewareRegistration<TOptions> {
    return {
      token: this,
      options,
    };
  }

  public abstract handle(context: Context, options?: TOptions): void | boolean | Promise<void | boolean>;
}
