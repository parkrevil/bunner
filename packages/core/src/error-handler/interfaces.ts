import type { Context } from '../common/interfaces';

export interface ErrorHandler<T = any> {
  catch(error: T, ctx: Context): any;
}
