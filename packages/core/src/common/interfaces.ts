export interface Adapter {
  // Base adapter interface
}

export interface Context<T = any> {
  getAdapter(): T;
}
