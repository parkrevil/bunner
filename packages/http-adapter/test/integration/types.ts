import type { ErrorFilterToken } from '@bunner/common';

export interface ErrorFilterRegistryParams {
  readonly useErrorFilters?: ReadonlyArray<ErrorFilterToken>;
  readonly useControllerFilters?: ReadonlyArray<ErrorFilterToken>;
  readonly includeOkRoute?: boolean;
}
