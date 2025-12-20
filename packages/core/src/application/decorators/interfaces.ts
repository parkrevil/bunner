import type { Class } from '../../common';
import type { ProviderScope, Provider } from '../../injector';

export interface RootModuleDecoratorOptions {
  path: string;
  providers?: Provider[];
  controllers?: Class[];
  imports?: Class[];
}

export interface ModuleDecoratorOptions extends Omit<RootModuleDecoratorOptions, 'path'> {
  exports?: Provider[];
}

export interface InjectableDecoratorOptions {
  scope?: ProviderScope;
}