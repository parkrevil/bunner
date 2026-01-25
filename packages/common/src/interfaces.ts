import type { AnyFunction, AnyValue, Class } from './types';

export interface BunnerAdapter {
  start(context: AnyValue): Promise<void>;
  stop(): Promise<void>;
}

export interface Context {
  getType(): string;
  get<T = AnyValue>(key: string): T | undefined;
  to<TContext>(ctor: Class<TContext>): TContext;
}

// DI Interfaces
export type ProviderToken = string | symbol | Class;

export type ProviderScope = 'singleton' | 'request-context' | 'transient';

export type ProviderVisibility = 'internal' | 'exported';

export interface ProviderBase {
  provide: ProviderToken;
}

export interface ProviderUseValue extends ProviderBase {
  useValue: AnyValue;
}

export interface ProviderUseClass extends ProviderBase {
  useClass: Class;
}

export interface ProviderUseExisting extends ProviderBase {
  useExisting: ProviderToken;
}

export interface ProviderUseFactory extends ProviderBase {
  useFactory: AnyFunction;
  inject?: ProviderToken[];
}

export interface ForwardRef {
  forwardRef: () => AnyValue;
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
  [protocol: string]: AdapterGroup<AnyValue>;
}

export interface Configurer {
  configure(app: AnyValue, adapters: AdapterCollection): void;
}

export interface BunnerApplicationOptions {
  name?: string;
  logLevel?: string | number;
  logger?: AnyValue;
  [key: string]: AnyValue;
}

export interface ConfigService {
  get<T = AnyValue>(namespace: string | symbol): T;
}

export interface EnvService {
  get(key: string, fallback?: string): string;
  getOptional(key: string): string | undefined;
  getInt(key: string, fallback: number): number;
  snapshot(): Readonly<Record<string, string>>;
}

export interface EnvSource {
  readonly name?: string;
  load(): Promise<Readonly<Record<string, string>>> | Readonly<Record<string, string>>;
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
  get(token: ProviderToken): AnyValue;
  set(token: ProviderToken, factory: AnyFunction): void;
  has(token: ProviderToken): boolean;
  getInstances(): IterableIterator<AnyValue>;
  keys(): IterableIterator<ProviderToken>;
}

export abstract class BunnerErrorFilter<TError = AnyValue> {
  public abstract catch(error: TError, context: Context): void | Promise<void>;
}

export type ErrorFilterToken = Class<BunnerErrorFilter>;

// Module Interface (Strict Schema Enforcement)
export interface BunnerModule {
  name?: string;
  providers?: Provider[];
  adapters?: AdapterConfig;
}

export interface AdapterConfig {
  [protocol: string]: {
    [instanceName: string]: AdapterInstanceConfig;
  };
}

export interface AdapterInstanceConfig {
  middlewares?: MiddlewareConfig;
  errorFilters?: ErrorFilterConfig[];
  [key: string]: AnyValue;
}

export interface MiddlewareConfig {
  [lifecycle: string]: Array<MiddlewareToken | MiddlewareRegistration>;
}

export type ErrorFilterConfig = ErrorFilterToken;

export type Provider = ProviderUseValue | ProviderUseClass | ProviderUseExisting | ProviderUseFactory | Class;
