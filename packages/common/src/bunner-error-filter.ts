import type { Context } from './interfaces';
import type { BunnerValue } from './types';

export abstract class BunnerErrorFilter<TError = BunnerValue> {
  public abstract catch(error: TError, context: Context): void | Promise<void>;
}
