export interface Adapter {
  // Base adapter interface
}

export interface Context {
  getType(): string;
  get<T = any>(key: string): T | undefined;
}
