import type { ProviderToken, ForwardRef } from '@bunner/common';

export type DependencyProvider = ProviderToken | ForwardRef;

export type ControllerWrapper<Options> = Options & {
  instance: InstanceType<any>;
};

export interface ModuleMetadata {
  imports?: any[];
  controllers?: any[];
  providers?: any[];
  exports?: any[];
}
