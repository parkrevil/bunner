export interface BunnerAdapter {
  start(context: any): Promise<void>;
  stop(): Promise<void>;
}

export interface Context {
  getType(): string;
  get<T = any>(key: string): T | undefined;
}

// DI Interfaces
import type { Class } from './types';

export type ProviderToken = string | symbol | Class;

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

// Lifecycle Interfaces
export interface OnModuleInit {
  onModuleInit(): Promise<void> | void;
}

export interface OnApplicationBootstrap {
  onApplicationBootstrap(): Promise<void> | void;
}

export interface OnApplicationShutdown {
  onApplicationShutdown(signal?: string): Promise<void> | void;
}
