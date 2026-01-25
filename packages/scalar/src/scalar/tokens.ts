import type { ScalarSetupOptions } from './interfaces';

export const ScalarSetupOptionsToken = Symbol.for('@bunner/scalar:setup-options');

export type ScalarSetupOptionsToken = typeof ScalarSetupOptionsToken;

export type ScalarSetupOptionsProvider = {
  readonly provide: ScalarSetupOptionsToken;
  readonly useValue: ScalarSetupOptions;
};
