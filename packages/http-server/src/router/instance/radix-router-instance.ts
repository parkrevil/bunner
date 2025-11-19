import { ROUTER_SNAPSHOT_METADATA } from '@bunner/core';

import { HttpMethod } from '../../enums';
import type { RadixRouterCore } from '../core/radix-router-core';
import type { RouterInstance } from '../interfaces';
import type { ImmutableRouterLayout } from '../layout/immutable-router-layout';
import type { RouterSnapshotMetadata, ParamOrderSnapshot, RouteMatch } from '../types';

export class RadixRouterInstance implements RouterInstance {
  constructor(private readonly core: RadixRouterCore) {
    Reflect.defineProperty(this, ROUTER_SNAPSHOT_METADATA, {
      value: core.getMetadata(),
      enumerable: false,
      configurable: false,
      writable: false,
    });
  }

  match(method: HttpMethod, path: string): RouteMatch | null {
    return this.core.match(method, path);
  }

  getMetadata(): RouterSnapshotMetadata {
    return this.core.getMetadata();
  }

  getLayoutSnapshot(): ImmutableRouterLayout | undefined {
    return this.core.getLayoutSnapshot();
  }

  exportParamOrderSnapshot(): ParamOrderSnapshot | null {
    return this.core.exportParamOrderingSnapshot();
  }
}
