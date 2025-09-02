import type { InjectableMetadata, ModuleMetadata, ProviderToken, Provider, ProviderScope } from './types';
import type { Class } from '../types';

/**
 * Inject Metadata
 * @description The metadata for an inject
 */
export interface InjectMetadata {
  index: number;
  token: ProviderToken | (() => any);
  provider: Class | undefined;
}

/**
 * Provider Base
 * @description The base for a provider
 */
export interface ProviderBase {
  token: ProviderToken;
}

/**
 * Provider Use Value
 * @description The value for a provider
 */
export interface ProviderUseValue extends ProviderBase {
  value: any;
}

/**
 * Provider Use Class
 * @description The class for a provider
 */
export interface ProviderUseClass extends ProviderBase {
  useClass: Class;
}

/**
 * Provider Use Exists
 * @description The exists for a provider
 */
export interface ProviderUseExisting extends ProviderBase {
  useExisting: Class;
}

/**
 * Provider Use Factory
 * @description The factory for a provider
 */
export interface ProviderUseFactory extends ProviderBase {
  useFactory: <T>(...args: any[]) => T | Promise<T>;
  inject?: ProviderToken[];
}

/**
 * Forward Ref Type
 * @description The type for a forward ref
 */
export interface ForwardRef {
  forwardRef: () => any;
};

/**
 * Dependency Graph Module Node
 * @description The node for a module
 */
export interface DependencyGraphModuleNode extends ModuleMetadata {}

/**
 * Dependency Graph Provider Node
 * @description The node for a provider
 */
export interface DependencyGraphProviderNode {
  provider: Provider;
  dependencies: ProviderToken[];
  scope: ProviderScope | undefined;
}

/**
 * Dependency Graph Controller Node
 * @description The node for a controller
 */
export interface DependencyGraphControllerNode {
  providers: DependencyGraphProviderNode[];
}
