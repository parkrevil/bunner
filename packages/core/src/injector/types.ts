import type {
  InjectableDecoratorOptions,
  ModuleDecoratorOptions,
} from '../application/decorators';
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

/**
 * Provider Scope
 * @description The scope for a provider
 */
export type ProviderScope = 'singleton' | 'transient' | 'request';

/**
 * Provider Token
 * @description The token for a provider
 */
export type ProviderToken = string | symbol | Class;

/**
 * Provider Type
 * @description The type for a provider
 */
export type Provider =
  | Class
  | ProviderUseValue
  | ProviderUseClass
  | ProviderUseExisting
  | ProviderUseFactory;

/**
 * Module decorator metadata
 * @description The metadata for a module
 */
export type ModuleMetadata = Required<ModuleDecoratorOptions>;

/**
 * Injectable Metadata
 * @description The metadata for an injectable
 */
export type InjectableMetadata = Required<InjectableDecoratorOptions>;

/**
 * Module Exports Type
 * @description The type for a module exports
 */
export type ModuleExportsType = Class | ProviderToken;

/**
 * Dependency Graph Node
 * @description The node for a dependency graph
 */
export type DependencyGraphNode =
  | DependencyGraphModule
  | DependencyGraphProvider
  | DependencyGraphController;

/**
 * Dependency Provider
 * @description The provider for a dependency graph
 */
export type DependencyProvider = ProviderToken | ForwardRef;

/**
 * Controller Instance
 * @description The instance for a controller contains metadata and instance
 */
export type Controller<Options> = Options & {
  instance: InstanceType<any>;
};
