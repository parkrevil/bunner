import type {
  BunnerValue,
  ConfigService,
  EnvService,
  PrimitiveArray,
  PrimitiveRecord,
  PrimitiveValue,
  Provider,
  ProviderToken,
  ProviderUseValue,
  ValueLike,
} from '@bunner/common';

import { CONFIG_SERVICE, ENV_SERVICE } from '@bunner/common';
import { config as dotenvConfig } from 'dotenv';

import type { BunnerApplication } from './bunner-application';
import type {
  BootstrapApplicationOptions,
  BootstrapConfigLoadParams,
  BootstrapEnvOptions,
  BunnerApplicationRuntimeOptions,
} from './interfaces';
import type { EntryModule } from './types';

import { BunnerScanner } from '../injector/scanner';
import { getRuntimeContext } from '../runtime/runtime-context';
import { createApplication } from './create-application';

function isRecord(value: BunnerValue): value is Record<string, BunnerValue> {
  return (typeof value === 'object' || typeof value === 'function') && value !== null;
}

function isPrimitiveValue(value: BunnerValue): value is PrimitiveValue {
  return (
    value === null ||
    value === undefined ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint' ||
    typeof value === 'symbol'
  );
}

function isPrimitiveArray(value: BunnerValue): value is PrimitiveArray {
  return Array.isArray(value) && value.every(isPrimitiveValue);
}

function isPrimitiveRecord(value: BunnerValue): value is PrimitiveRecord {
  if (!isRecord(value)) {
    return false;
  }

  for (const key of Object.keys(value)) {
    const entry = value[key];

    if (!isPrimitiveValue(entry) && !isPrimitiveArray(entry)) {
      return false;
    }
  }

  return true;
}

function isValueLike(value: BunnerValue): value is ValueLike {
  return isPrimitiveValue(value) || isPrimitiveArray(value) || isPrimitiveRecord(value) || typeof value === 'function';
}

function isStringRecord(value: BunnerValue): value is Record<string, string> {
  if (!isRecord(value)) {
    return false;
  }

  for (const key of Object.keys(value)) {
    const entry = value[key];

    if (typeof entry !== 'string') {
      return false;
    }
  }

  return true;
}

function isValueLikeRecord(value: BunnerValue): value is Record<string, ValueLike> {
  if (!isRecord(value)) {
    return false;
  }

  for (const key of Object.keys(value)) {
    const entry = value[key];

    if (!isValueLike(entry)) {
      return false;
    }
  }

  return true;
}

function isValueLikeMap(value: ReadonlyMap<string | symbol, ValueLike>): boolean {
  for (const [key, entry] of value.entries()) {
    if (typeof key !== 'string' && typeof key !== 'symbol') {
      return false;
    }

    if (!isValueLike(entry)) {
      return false;
    }
  }

  return true;
}

function hasProviderToken(providers: readonly Provider[], token: ProviderToken): boolean {
  return providers.some(p => {
    if (p === null || p === undefined) {
      return false;
    }

    if (typeof p === 'function') {
      return p === token;
    }

    if (typeof p === 'object' && p !== null && 'provide' in p) {
      return p.provide === token;
    }

    return false;
  });
}

function createEnvService(snapshot: Readonly<Record<string, string>>): EnvService {
  return {
    get(key: string, fallback?: string): string {
      const value = snapshot[key];

      if (typeof value === 'string') {
        return value;
      }

      if (fallback !== undefined) {
        return fallback;
      }

      throw new Error(`Env key not found: ${key}`);
    },
    getOptional(key: string): string | undefined {
      const value = snapshot[key];

      if (typeof value === 'string') {
        return value;
      }

      return undefined;
    },
    getInt(key: string, fallback: number): number {
      const raw = snapshot[key];

      if (typeof raw !== 'string' || raw.length === 0) {
        return fallback;
      }

      const parsed = Number.parseInt(raw, 10);

      if (!Number.isFinite(parsed)) {
        return fallback;
      }

      return parsed;
    },
    snapshot(): Readonly<Record<string, string>> {
      return snapshot;
    },
  };
}

function createConfigService(values: ReadonlyMap<string | symbol, ValueLike>): ConfigService {
  return {
    get(namespace: string | symbol): ValueLike {
      const value = values.get(namespace);

      if (value === undefined) {
        throw new Error(`Config namespace not found: ${String(namespace)}`);
      }

      return value;
    },
  };
}

async function loadEnvSnapshot(options: BootstrapEnvOptions | undefined): Promise<Readonly<Record<string, string>> | undefined> {
  if (!options) {
    return undefined;
  }

  const result: Record<string, string> = {};
  const dotenvFile = options.dotenvFile ?? '.env';
  const includeProcessEnv = options.includeProcessEnv !== false;

  if (typeof dotenvFile === 'string' && dotenvFile.length > 0) {
    const parsed = dotenvConfig({ path: dotenvFile }).parsed;

    if (!parsed && options.dotenvStrict === true) {
      throw new Error(`Failed to load dotenv file: ${dotenvFile}`);
    }

    if (parsed) {
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === 'string') {
          result[k] = v;
        }
      }
    }
  }

  const sources = options.sources ?? [];

  for (const source of sources) {
    const loaded = await Promise.resolve(source.load());

    if (!isStringRecord(loaded)) {
      continue;
    }

    for (const [k, v] of Object.entries(loaded)) {
      if (typeof v === 'string') {
        result[k] = v;
      }
    }
  }

  if (includeProcessEnv) {
    for (const [k, v] of Object.entries(Bun.env)) {
      if (typeof v === 'string') {
        result[k] = v;
      }
    }
  }

  if (options.mutateProcessEnv === true) {
    for (const [k, v] of Object.entries(result)) {
      Bun.env[k] ??= v;
    }
  }

  return result;
}

async function loadConfigMap(params: BootstrapConfigLoadParams): Promise<ReadonlyMap<string | symbol, ValueLike>> {
  const result = new Map<string | symbol, ValueLike>();

  for (const loader of params.loaders) {
    const loaded = await Promise.resolve(loader({ env: params.env }));

    if (!loaded) {
      continue;
    }

    if (loaded instanceof Map) {
      const valueMap: ReadonlyMap<string | symbol, ValueLike> = loaded;

      if (!isValueLikeMap(valueMap)) {
        continue;
      }

      for (const [key, value] of valueMap.entries()) {
        result.set(key, value);
      }

      continue;
    }

    if (!isRecord(loaded)) {
      continue;
    }

    if (!isValueLikeRecord(loaded)) {
      continue;
    }

    Object.entries(loaded).forEach(([key, value]) => {
      result.set(key, value);
    });
  }

  return result;
}

/**
 * Bootstraps an application, applies configuration, and starts it.
 *
 * @param entry Application entry.
 * @param options Bootstrap options.
 * @returns The started application instance.
 */
async function bootstrapApplication(entry: EntryModule, options?: BootstrapApplicationOptions): Promise<BunnerApplication> {
  const preloadProviders = (await options?.preload?.()) ?? [];
  const baseProviders = [...preloadProviders, ...(options?.providers ?? [])];
  const envSnapshot = await loadEnvSnapshot(options?.env);
  const mergedProviders: Provider[] = [...baseProviders];

  if (envSnapshot && !hasProviderToken(mergedProviders, ENV_SERVICE)) {
    const envService = createEnvService(envSnapshot);

    mergedProviders.push({ provide: ENV_SERVICE, useValue: envService });
  }

  const configLoaders = options?.config?.loaders ?? [];
  const hasConfigLoaders = configLoaders.length > 0;
  const hasEnvService = hasProviderToken(mergedProviders, ENV_SERVICE);

  if (hasConfigLoaders && hasEnvService && !hasProviderToken(mergedProviders, CONFIG_SERVICE)) {
    const envService = getEnvService(mergedProviders);

    if (!envService) {
      throw new Error('EnvService provider is missing or invalid');
    }

    const configMap = await loadConfigMap({ env: envService, loaders: configLoaders });
    const configService = createConfigService(configMap);

    mergedProviders.push({ provide: CONFIG_SERVICE, useValue: configService });
  }

  const aotContainer = getRuntimeContext().container;
  const providedContainer = options?.container;
  const runtimeContainer = providedContainer ?? aotContainer;
  const runtimeOptions: BunnerApplicationRuntimeOptions = {
    ...(options?.name !== undefined ? { name: options.name } : {}),
    ...(options?.logLevel !== undefined ? { logLevel: options.logLevel } : {}),
    ...(options?.logger !== undefined ? { logger: options.logger } : {}),
    ...(options?.adapterConfig !== undefined ? { adapterConfig: options.adapterConfig } : {}),
    ...(options?.skipScanning !== undefined ? { skipScanning: options.skipScanning } : {}),
    ...(runtimeContainer !== undefined ? { container: runtimeContainer } : {}),
    providers: mergedProviders,
  };
  const app = await createApplication(entry, runtimeOptions);

  if (mergedProviders.length > 0) {
    const scanner = new BunnerScanner(app.getContainer());

    await scanner.scan({ providers: mergedProviders });
  }

  const adapters = options?.adapters ?? [];

  for (const adapter of adapters) {
    await adapter.install(app);
  }

  if (options?.configure) {
    await options.configure(app);
  }

  await app.start();

  return app;
}

function isProviderWithValue(provider: Provider): provider is ProviderUseValue {
  return typeof provider === 'object' && provider !== null && 'provide' in provider && 'useValue' in provider;
}

function isEnvService(value: ProviderUseValue['useValue']): value is EnvService {
  if (!isRecord(value)) {
    return false;
  }

  const get = value.get;
  const getOptional = value.getOptional;

  return typeof get === 'function' && typeof getOptional === 'function';
}

function getEnvService(providers: ReadonlyArray<Provider>): EnvService | undefined {
  const provider = providers.find(item => {
    if (typeof item !== 'object' || item === null) {
      return false;
    }

    if (!('provide' in item)) {
      return false;
    }

    return item.provide === ENV_SERVICE;
  });

  if (!provider || !isProviderWithValue(provider)) {
    return undefined;
  }

  if (!isEnvService(provider.useValue)) {
    return undefined;
  }

  return provider.useValue;
}

export { bootstrapApplication };
export type { BootstrapApplicationOptions, BootstrapConfigLoadParams, BootstrapEnvOptions } from './interfaces';
export type { BootstrapAdapter, BootstrapConfigOptions } from './interfaces';
export type { BootstrapConfigLoader } from './types';
