import type { InjectableScope, InjectableVisibility } from './types';

export interface InjectableOptions {
  scope?: InjectableScope;
  visibleTo?: InjectableVisibility;
}
