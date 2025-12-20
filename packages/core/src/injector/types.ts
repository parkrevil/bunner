import type { InjectableDecoratorOptions, ModuleDecoratorOptions, RootModuleDecoratorOptions } from '../application/decorators';
import type { Class } from '../common/types';

import type {
  ProviderUseValue,
  ProviderUseClass,
  ProviderUseExisting,
  ProviderUseFactory,
  ForwardRef,
  DependencyGraphModule,
  DependencyGraphProvider,
  DependencyGraphController,
} from './interfaces';

export type ProviderScope = 'singleton' | 'transient' | 'request';

export type ProviderToken = string | symbol | Class;

export type Provider = Class | ProviderUseValue | ProviderUseClass | ProviderUseExisting | ProviderUseFactory;

export type RootModuleMetadata = Required<RootModuleDecoratorOptions>;

export type ModuleMetadata = Required<ModuleDecoratorOptions>;

export type InjectableMetadata = Required<InjectableDecoratorOptions>;

export type ModuleExportsType = Class | ProviderToken;

export type DependencyGraphNode = DependencyGraphModule | DependencyGraphProvider | DependencyGraphController;

export type DependencyProvider = ProviderToken | ForwardRef;

export type ControllerWrapper<Options> = Options & {
  instance: InstanceType<any>;
};
