import type { BunnerModule } from '../interfaces';

export interface InjectableOptions {
  lifetime?: 'singleton' | 'request-context' | 'transient';
  visibility?: 'internal' | 'exported';
}

export function Injectable(_options?: InjectableOptions): ClassDecorator {
  return () => {};
}

export function Module(_metadata: BunnerModule): ClassDecorator {
  return () => {};
}
