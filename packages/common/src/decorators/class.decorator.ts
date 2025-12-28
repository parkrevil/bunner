export interface InjectableOptions {
  lifetime?: 'singleton' | 'request-context' | 'transient';
  visibility?: 'internal' | 'exported';
}

export function Injectable(_options?: InjectableOptions) {
  return (_target: Function) => {};
}

export function Module(_metadata: any) {
  return (_target: Function) => {};
}
