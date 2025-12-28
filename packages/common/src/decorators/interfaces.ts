import type { Provider, ProviderScope } from '../interfaces';
import type { Class } from '../types';

export interface ModuleDecoratorOptions {
  imports?: Class[];
  controllers?: Class[];
  providers?: Provider[];
  exports?: Provider[];
}

export interface InjectableDecoratorOptions {
  scope?: ProviderScope;
}
