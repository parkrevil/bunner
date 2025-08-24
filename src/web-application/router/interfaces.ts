import type { HttpMethodType } from '../types';
import type { RouteHandler } from './types';

export interface RouteNode {
  paramRegExp?: RegExp;
  handlers?: Partial<Record<HttpMethodType, RouteHandler>>;
}
