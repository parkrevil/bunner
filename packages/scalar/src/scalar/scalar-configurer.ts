import type { AdapterCollection, Configurer } from '@bunner/common';

import type { ScalarSetupOptions } from './interfaces';

import { setupScalar } from './setup';

export class ScalarConfigurer implements Configurer {
  public constructor(private readonly options: ScalarSetupOptions) {}

  public configure(_app: unknown, adapters: AdapterCollection): void {
    setupScalar(adapters, this.options);
  }
}
