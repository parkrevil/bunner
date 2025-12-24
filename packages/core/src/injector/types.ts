import type { InjectableDecoratorOptions, ModuleDecoratorOptions, Class, ProviderToken, ForwardRef } from '@bunner/common';

export type DependencyProvider = ProviderToken | ForwardRef;

export type ControllerWrapper<Options> = Options & {
  instance: InstanceType<any>;
};
