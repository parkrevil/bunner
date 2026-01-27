import type { BunnerMiddleware } from './bunner-middleware';
import type { BunnerFunction, BunnerValue, Class, ClassToken, ValueLike } from './types';

export interface BunnerAdapter {
  start(context: Context): Promise<void>;
  stop(): Promise<void>;
}

export interface Context {
  getType(): string;
  get(key: string): BunnerValue | undefined;
  to<TContext extends BunnerValue>(ctor: ClassToken<TContext>): TContext;
}

// DI Interfaces
export type ProviderToken = string | symbol | ClassToken | Class;

export type ProviderScope = 'singleton' | 'request-context' | 'transient';

export type ProviderVisibility = 'internal' | 'exported';

export interface ProviderBase {
  provide: ProviderToken;
}

export interface ProviderUseValue extends ProviderBase {
  useValue: BunnerValue | EnvService | ConfigService;
}

export interface ProviderUseClass extends ProviderBase {
  useClass: Class;
}

export interface ProviderUseExisting extends ProviderBase {
  useExisting: ProviderToken;
}

export interface ProviderUseFactory extends ProviderBase {
  useFactory: BunnerFunction;
  inject?: ProviderToken[];
}

export interface ForwardRef {
  forwardRef: () => BunnerValue;
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
  [protocol: string]: AdapterGroup<BunnerAdapter>;
}

export interface Configurer {
  configure(app: Context, adapters: AdapterCollection): void;
}

export interface BunnerApplicationOptions {
  name?: string;
  logLevel?: string | number;
  logger?: BunnerValue;
}

export interface ConfigService {
  get(namespace: string | symbol): ValueLike;
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

export type MiddlewareToken<TOptions = BunnerValue> = Class<BunnerMiddleware<TOptions>> | symbol;

export interface MiddlewareRegistration<TOptions = BunnerValue> {
  token: MiddlewareToken<TOptions>;
  options?: TOptions;
}

export type BunnerFactory<TValue = BunnerValue> = (container: BunnerContainer) => TValue;

export interface BunnerContainer {
  get(token: ProviderToken): BunnerValue;
  set<TValue = BunnerValue>(token: ProviderToken, factory: BunnerFactory<TValue>): void;
  has(token: ProviderToken): boolean;
  getInstances(): IterableIterator<BunnerValue>;
  keys(): IterableIterator<ProviderToken>;
}

export type ErrorFilterToken = ProviderToken;

// Module Interface (Strict Schema Enforcement)
export interface BunnerModule {
  name?: string;
  providers?: Provider[];
  adapters?: AdapterConfig;
}

export interface AdapterConfig {
  [protocol: string]: AdapterProtocolConfig;
}

export interface AdapterProtocolConfig {
  [instanceName: string]: AdapterInstanceConfig;
}

export interface AdapterInstanceConfig {
  middlewares?: MiddlewareConfig;
  errorFilters?: ErrorFilterConfig[];
  [key: string]: BunnerValue | MiddlewareConfig | ErrorFilterConfig[];
}

export interface MiddlewareConfig {
  [lifecycle: string]: Array<MiddlewareToken | MiddlewareRegistration>;
}

export type ErrorFilterConfig = ErrorFilterToken;

export type Provider = ProviderUseValue | ProviderUseClass | ProviderUseExisting | ProviderUseFactory | Class;
