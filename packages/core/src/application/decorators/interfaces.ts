import type { Class } from '../../common';
import type { ProviderScope, Provider } from '../../injector';

/**
 * Module decorator options
 * @description The metadata for a module
 */
export interface RootModuleDecoratorOptions {
  path: string;
  providers?: Provider[];
  controllers?: Class[];
  imports?: Class[];
}

/**
 * Module decorator options
 * @description The metadata for a module
 */
export interface ModuleDecoratorOptions
  extends Omit<RootModuleDecoratorOptions, 'path'> {
  exports?: Provider[];
}

/**
 * Injectable decorator options
 * @description The metadata for an injectable
 */
export interface InjectableDecoratorOptions {
  scope?: ProviderScope;
}
