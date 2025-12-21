import type { Context } from '../common/interfaces';

export interface Middleware {
  handle(ctx: Context): Promise<void> | void;
}

export function Middleware(): ClassDecorator {
  return () => {};
}
