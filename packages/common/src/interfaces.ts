import type { Class } from './types';

export interface BunnerAdapter {
  start(context: any): Promise<void>;
  stop(): Promise<void>;
}

export interface Context {
  getType(): string;
  get<T = unknown>(key: string): T | undefined;
  to<TContext>(ctor: Class<TContext>): TContext;
}

// DI Interfaces
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
export interface OnInit {
  onInit(): Promise<void> | void;
}

export interface BeforeStart {
  beforeStart(): Promise<void> | void;
}

export interface OnStart {
  onStart(): Promise<void> | void;
}

export interface OnShutdown {
  onShutdown(signal?: string): Promise<void> | void;
}

export interface OnDestroy {
  onDestroy(): Promise<void> | void;
}

export interface AdapterGroup<T> {
  get(name: string): T | undefined;
  all(): T[];
  forEach(cb: (adapter: T) => void): void;
}

export interface AdapterCollection {
  [protocol: string]: AdapterGroup<any>;
}

export interface Configurer {
  configure(app: any, adapters: AdapterCollection): void;
}

export interface BunnerApplicationOptions {
  name?: string;
  logLevel?: string | number;
  logger?: any;
  [key: string]: any;
}

export class BunnerContextError extends Error {
  constructor(message: string) {
    super(message);

    this.name = 'BunnerContextError';
  }
}

export abstract class BunnerMiddleware<TOptions = void> {
  public static withOptions<T extends typeof BunnerMiddleware, TOptions>(
    this: T,
    options: TOptions,
  ): MiddlewareRegistration<TOptions> {
    return {
      token: this as unknown as MiddlewareToken<TOptions>,
      options,
    };
  }

  public abstract handle(context: Context, options?: TOptions): void | boolean | Promise<void | boolean>;
}

export type MiddlewareToken<TOptions = unknown> = Class<BunnerMiddleware<TOptions>> | symbol;

export interface MiddlewareRegistration<TOptions = unknown> {
  token: MiddlewareToken<TOptions>;
  options?: TOptions;
}

export interface BunnerContainer {
  get<T = any>(token: any): T;
  set(token: any, factory: any): void;
  has(token: any): boolean;
  getInstances(): IterableIterator<any>;
  keys(): IterableIterator<any>;
}

export abstract class BunnerErrorFilter<TError = unknown> {
  public abstract catch(error: TError, context: Context): void | Promise<void>;
}

export type ErrorFilterToken = Class<BunnerErrorFilter>;
