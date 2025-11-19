import { HttpMethod } from '../../enums';
import type { RouteKey } from '../../types';
import { RadixRouterCore } from '../core/radix-router-core';
import { RadixRouterInstance } from '../instance/radix-router-instance';
import type { RouterBuilder, RouterInstance } from '../interfaces';
import type { RouterOptions } from '../types';

export class RadixRouterBuilder implements RouterBuilder {
  private core: RadixRouterCore | null;

  constructor(options?: RouterOptions) {
    this.core = new RadixRouterCore(options);
  }

  add(method: HttpMethod | HttpMethod[] | '*', path: string): RouteKey | RouteKey[] {
    this.assertActive();
    return this.core!.add(method, path);
  }

  addAll(entries: Array<[HttpMethod, string]>): RouteKey[] {
    this.assertActive();
    return this.core!.addAll(entries);
  }

  build(): RouterInstance {
    this.assertActive();
    const core = this.core!;
    core.finalizeBuild();
    this.core = null;
    return new RadixRouterInstance(core);
  }

  private assertActive(): void {
    if (!this.core) {
      throw new Error('RouterBuilder has already been finalized. Instantiate a new builder for additional routes.');
    }
  }
}
