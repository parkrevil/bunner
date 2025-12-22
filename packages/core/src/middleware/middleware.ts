import type { Context } from '../common/interfaces';

export interface Middleware {
  handle(ctx: Context): Promise<boolean | void> | boolean | void;
}

export function Middleware(): ClassDecorator {
  return () => {};
}
