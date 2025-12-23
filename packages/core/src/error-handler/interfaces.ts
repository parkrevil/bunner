import type { Context } from '@bunner/common';

export interface ErrorHandler<T = any> {
  catch(error: T, ctx: Context): any;
}
