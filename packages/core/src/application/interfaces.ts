import { type Container } from '../injector/container';

export interface BunnerApplicationBaseOptions {
  name: string;
  logLevel: number;
  workers: number;
  queueCapacity: number;
}

export type BunnerApplicationNormalizedOptions = BunnerApplicationBaseOptions & { [key: string]: any };

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

export interface BunnerModule {}

export interface DynamicModule {
  module: any;
  providers?: any[];
  controllers?: any[];
  imports?: any[];
  exports?: any[];
  global?: boolean;
}
