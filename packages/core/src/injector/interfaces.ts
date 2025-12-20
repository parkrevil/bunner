import type { Class } from '../common/types';

import type { ModuleMetadata, ProviderToken, Provider, ProviderScope, DependencyProvider } from './types';

export interface InjectMetadata {
  index: number;
  token: ProviderToken | ForwardRef;
  provider: Class | undefined;
}

export interface ProviderBase {
  token: ProviderToken;
}

export interface ProviderUseValue extends ProviderBase {
  useValue: any;
}

export interface ProviderUseClass extends ProviderBase {
  useClass: Class;
}

export interface ProviderUseExisting extends ProviderBase {
  useExisting: Class;
}

export interface ProviderUseFactory extends ProviderBase {
  useFactory: <T>(...args: any[]) => T | Promise<T>;
  inject?: ProviderToken[];
}

export interface ForwardRef {
  forwardRef: () => any;
}

export interface DependencyGraphBase {
  type: 'module' | 'provider' | 'controller';
}

export interface DependencyGraphModule extends DependencyGraphBase, ModuleMetadata {}

export interface DependencyGraphProvider extends DependencyGraphBase {
  provider: Provider;
  dependencies: DependencyProvider[];
  scope: ProviderScope | undefined;
}

export interface DependencyGraphController extends DependencyGraphBase {
  dependencies: DependencyProvider[];
}
