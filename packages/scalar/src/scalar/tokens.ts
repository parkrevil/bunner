import type { BunnerValue } from '@bunner/common';

import type { ScalarSetupOptions } from './interfaces';
import type { ScalarConfigurer } from './scalar-configurer';

export const ScalarSetupOptionsToken = Symbol.for('@bunner/scalar:setup-options');
export const ScalarConfigurerToken = Symbol.for('@bunner/scalar:configurer');

export type ScalarSetupOptionsToken = typeof ScalarSetupOptionsToken;
export type ScalarConfigurerToken = typeof ScalarConfigurerToken;

export interface ScalarSetupOptionsProvider {
  readonly provide: ScalarSetupOptionsToken;
  readonly useValue: ScalarSetupOptions;
}

export interface ScalarConfigurerProvider {
  readonly provide: ScalarConfigurerToken;
  readonly useFactory: (...args: readonly BunnerValue[]) => ScalarConfigurer;
  readonly inject: readonly [ScalarSetupOptionsToken];
}
