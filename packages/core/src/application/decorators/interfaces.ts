import type { Class } from '../../common';
import type { ProviderScope, Provider } from '../../injector';

export interface ModuleDecoratorOptions {
  imports?: Class[];
  controllers?: Class[];
  providers?: Provider[];
  exports?: Provider[];
}

export interface InjectableDecoratorOptions {
  scope?: ProviderScope;
}
