import type {
  AdapterConfig,
  BunnerAdapter,
  BunnerApplicationOptions,
  Class,
  Context,
  ErrorFilterConfig,
  EnvService,
  EnvSource,
  MiddlewareRegistration,
  MiddlewareToken,
  Provider,
  ProviderToken,
} from '@bunner/common';
import type { Container } from '../injector/container';
import type { BunnerApplication } from './bunner-application';
import type {
  ApplicationOptionValue,
  BootstrapConfigLoader,
  EntryModule,
  ModuleMetadataValue,
} from './types';

export type { BunnerApplicationNormalizedOptions } from './types';

export interface BunnerApplicationBaseOptions {
  name: string;
  logLevel: string | number;
}

export interface EntryModuleMetadata {
  path: string;
  className: string;
  manifestPath?: string;
}

export interface BunnerApplicationRuntimeOptions extends BunnerApplicationOptions {
  container?: Container;
  providers?: ReadonlyArray<Provider>;
  adapterConfig?: AdapterConfig;
  skipScanning?: boolean;
}

// Simplified Module Interface
export interface BunnerModule {
  imports?: ReadonlyArray<BunnerModule | DynamicModule | Class>;
  controllers?: ReadonlyArray<Class>;
  providers?: ReadonlyArray<Provider>;
  exports?: ReadonlyArray<ProviderToken>;
  adapters?: AdapterConfig;
  [key: string]: ModuleMetadataValue;
}

export interface CreateApplicationOptions extends BunnerApplicationBaseOptions {
  [key: string]: ApplicationOptionValue;
}

export interface AdapterRegistrationOptions {
  name?: string;
  protocol?: string;
}

export interface ConfigurableAdapter extends BunnerAdapter {
  addMiddlewares?(lifecycle: string, items: ReadonlyArray<MiddlewareToken | MiddlewareRegistration>): void;
  addErrorFilters?(filters: ReadonlyArray<ErrorFilterConfig>): void;
}

export interface BunnerApplicationContext extends Context {
  container: Container;
  entryModule: EntryModule;
}

export interface BootstrapAdapter {
  install(app: BunnerApplication): void | Promise<void>;
}

export interface BootstrapConfigLoaderParams {
  env: EnvService;
}

export interface BootstrapConfigLoadParams {
  env: EnvService;
  loaders: ReadonlyArray<BootstrapConfigLoader>;
}

export interface BootstrapEnvOptions {
  dotenvFile?: string | false;
  dotenvStrict?: boolean;
  sources?: ReadonlyArray<EnvSource>;
  includeProcessEnv?: boolean;
  mutateProcessEnv?: boolean;
}

export interface BootstrapConfigOptions {
  loaders?: ReadonlyArray<BootstrapConfigLoader>;
}

export interface BootstrapApplicationOptions extends BunnerApplicationRuntimeOptions {
  adapters?: ReadonlyArray<BootstrapAdapter>;
  env?: BootstrapEnvOptions;
  config?: BootstrapConfigOptions;
  configure?: (app: BunnerApplication) => void | Promise<void>;
  preload?: () => Promise<ReadonlyArray<Provider> | void>;
}

// Single definition of BunnerModule removed below

export interface DynamicModule {
  module: Class;
  providers?: ReadonlyArray<Provider>;
  controllers?: ReadonlyArray<Class>;
  imports?: ReadonlyArray<BunnerModule | DynamicModule | Class>;
  exports?: ReadonlyArray<ProviderToken>;
  global?: boolean;
}
