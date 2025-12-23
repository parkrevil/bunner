import type { Class, ProviderScope, Provider } from '../types';

export interface ModuleDecoratorOptions {
  imports?: Class[];
  controllers?: Class[];
  providers?: Provider[];
  exports?: Provider[];
}

export interface InjectableDecoratorOptions {
  scope?: ProviderScope;
}
