import type { Context } from '@bunner/common';

export interface Middleware {
  handle(ctx: Context): Promise<boolean | void> | boolean | void;
}

export function Middleware(): ClassDecorator {
  return () => {};
}
