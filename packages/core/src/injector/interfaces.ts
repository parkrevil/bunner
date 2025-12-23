import type { Class, ProviderToken, Provider, ProviderScope } from '@bunner/common';

import type { ModuleMetadata, DependencyProvider } from './types';

export interface InjectMetadata {
  index: number;
  token: ProviderToken | import('@bunner/common').ForwardRef;
  provider: Class | undefined;
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
