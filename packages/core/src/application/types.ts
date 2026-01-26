import type {
  BeforeStart,
  Class,
  OnDestroy,
  OnInit,
  OnShutdown,
  OnStart,
  Provider,
  ProviderToken,
  ValueLike,
} from '@bunner/common';
import type {
  BootstrapConfigLoaderParams,
  BunnerApplicationBaseOptions,
  BunnerModule,
  DynamicModule,
} from './interfaces';

export type ApplicationOptionValue = string | number | boolean | null | undefined;

export type ModuleMetadataValue =
  | ApplicationOptionValue
  | Class
  | Provider
  | ProviderToken
  | BunnerModule
  | DynamicModule
  | ReadonlyArray<Class | Provider | ProviderToken | BunnerModule | DynamicModule | ApplicationOptionValue>;

export type BunnerApplicationNormalizedOptions = BunnerApplicationBaseOptions & Record<string, ApplicationOptionValue>;

export type EntryModule = BunnerModule | DynamicModule | Class;

export type LifecycleHookMethod = keyof (OnInit & BeforeStart & OnStart & OnShutdown & OnDestroy);

export type BootstrapConfigLoader = (params: BootstrapConfigLoaderParams) =>
  | Promise<Readonly<Record<string, ValueLike>> | ReadonlyMap<string | symbol, ValueLike> | void>
  | Readonly<Record<string, ValueLike>>
  | ReadonlyMap<string | symbol, ValueLike>
  | void;
