import type { AdapterCollection } from '@bunner/common';

import type { ScalarSetupOptions } from './interfaces';
import { setupScalar } from './setup';

export class Scalar {
  /**
   * Registers Scalar documentation routes on selected HTTP adapter(s).
   *
   * @param adapters Adapter collection registered by the application.
   * @param options Scalar setup options.
   * @returns Nothing.
   */
  static setup(adapters: AdapterCollection, options: ScalarSetupOptions): void {
    setupScalar(adapters, options);
  }
}
