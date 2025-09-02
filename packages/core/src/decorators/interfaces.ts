import type { Class } from '../types';
import type { ProviderToken, ProviderScope, ProviderType } from './types';


/**
 * Module decorator options
 * @description The metadata for a module
 */
export interface ModuleDecoratorOptions {
  providers?: ProviderType[];
  controllers?: Class[];
  imports?: Class[];
  exports?: ProviderType[];
}

/**
 * Module decorator metadata
 * @description The metadata for a module
 */
export interface ModuleMetadata extends ModuleDecoratorOptions {}

/**
 * Injectable decorator options
 * @description The metadata for an injectable
 */
export interface InjectableDecoratorOptions {
  scope?: ProviderScope;
}

/**
 * Injectable Metadata
 * @description The metadata for an injectable
 */
export interface InjectableMetadata extends InjectableDecoratorOptions {}

/**
 * Provider Base
 * @description The base for a provider
 */
export interface ProviderBase {
  provide: ProviderToken;
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
export interface ProviderUseExists extends ProviderBase {
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

export interface InjectMetadata {
  index: number;
  token: ProviderToken | (() => any);
  type: Class | undefined;
}
