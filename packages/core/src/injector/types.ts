import type { InjectableDecoratorOptions, ModuleDecoratorOptions, Class, ProviderToken, ForwardRef } from '@bunner/common';

import type { DependencyGraphModule, DependencyGraphProvider, DependencyGraphController } from './interfaces';

export type RootModuleMetadata = Required<ModuleDecoratorOptions>;

export type ModuleMetadata = Required<ModuleDecoratorOptions>;

export type InjectableMetadata = Required<InjectableDecoratorOptions>;

export type ModuleExportsType = Class | ProviderToken;

export type DependencyGraphNode = DependencyGraphModule | DependencyGraphProvider | DependencyGraphController;

export type DependencyProvider = ProviderToken | ForwardRef;

export type ControllerWrapper<Options> = Options & {
  instance: InstanceType<any>;
};
