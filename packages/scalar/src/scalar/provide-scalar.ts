import type { Provider } from '@bunner/common';

import type { ScalarSetupOptions } from './interfaces';

import { ScalarConfigurer } from './scalar-configurer';
import { ScalarSetupOptionsToken } from './tokens';

export function provideScalar(options: ScalarSetupOptions): readonly Provider[] {
  return [
    { provide: ScalarSetupOptionsToken, useValue: options },
    {
      provide: ScalarConfigurer,
      useFactory: (opts: ScalarSetupOptions) => new ScalarConfigurer(opts),
      inject: [ScalarSetupOptionsToken],
    },
  ];
}
