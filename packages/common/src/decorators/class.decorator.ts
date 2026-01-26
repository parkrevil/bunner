import type { BunnerModule } from '../interfaces';
import type { DecoratorTarget } from '../types';

export interface InjectableOptions {
  lifetime?: 'singleton' | 'request-context' | 'transient';
  visibility?: 'internal' | 'exported';
}

export function Injectable(_options?: InjectableOptions) {
  return (_target: DecoratorTarget) => {};
}

export function Module(_metadata: BunnerModule) {
  return (_target: DecoratorTarget) => {};
}
