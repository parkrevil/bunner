import type { HttpMethodType } from '../types';

export interface Route {
  path: string;
  method: HttpMethodType;
}
