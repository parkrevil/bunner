import { HttpMethod } from '../../enums';
import type { RadixRouterCore } from '../core/radix-router-core';
import type { RouterInstance } from '../interfaces';
import type { RouteMatch } from '../types';

export class RadixRouterInstance implements RouterInstance {
  constructor(private readonly core: RadixRouterCore) {}

  match(method: HttpMethod, path: string): RouteMatch | null {
    return this.core.match(method, path);
  }
}
