import { type Container } from '../injector/container';

export interface BunnerApplicationBaseOptions {
  name: string;
  logLevel: number;
  workers: number;
  queueCapacity: number;
}

// Removed generic T from NormalizedOptions as well.
export type BunnerApplicationNormalizedOptions = BunnerApplicationBaseOptions & { [key: string]: any };

// Removed generic T as it was causing lint issues and seemingly unused for now.
export interface BunnerApplicationOptions {
  name?: string;
  logLevel?: number;
  workers?: number | 'full' | 'half';
  queueCapacity?: number;
  [key: string]: any;
}

export interface RootModuleFile {
  path: string;
  className: string;
  container?: Container;
  manifestPath?: string;
  metadata?: Map<any, any>;
}

export interface CreateApplicationOptions extends BunnerApplicationBaseOptions {
  [key: string]: any;
}
