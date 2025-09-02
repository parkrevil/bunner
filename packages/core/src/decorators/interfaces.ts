import type { ProviderScope, Provider } from '../injector';
import type { Class } from '../types';

/**
 * Module decorator options
 * @description The metadata for a module
 */
export interface ModuleDecoratorOptions {
  providers?: Provider[];
  controllers?: Class[];
  imports?: Class[];
  exports?: Provider[];
}

/**
 * Injectable decorator options
 * @description The metadata for an injectable
 */
export interface InjectableDecoratorOptions {
  scope?: ProviderScope;
}
