import type { Context } from '../common/interfaces';

export interface ErrorHandler<T = any, C = any> {
  catch(error: T, ctx: Context<C>): any;
}
