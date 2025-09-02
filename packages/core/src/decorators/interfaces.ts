import type { Class } from '../types';
import type { ProviderScope, ProviderType } from '../injector';


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
 * Injectable decorator options
 * @description The metadata for an injectable
 */
export interface InjectableDecoratorOptions {
  scope?: ProviderScope;
}
