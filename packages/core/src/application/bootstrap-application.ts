import type {
  ConfigService,
  EnvService,
  Provider,
  ProviderToken,
  ProviderUseValue,
  ValueLike,
} from '@bunner/common';

import { CONFIG_SERVICE, ENV_SERVICE } from '@bunner/common';
import { config as dotenvConfig } from 'dotenv';

import type {
  BootstrapApplicationOptions,
  BootstrapConfigLoadParams,
  BootstrapEnvOptions,
} from './interfaces';
import type { EntryModule } from './types';

import { BunnerScanner } from '../injector/scanner';
import { getRuntimeContext } from '../runtime/runtime-context';
import { createApplication } from './create-application';

function hasProviderToken(providers: readonly Provider[], token: ProviderToken): boolean {
  return providers.some(p => {
    if (!p) {
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

  if (dotenvFile) {
    const parsed = dotenvConfig({ path: dotenvFile }).parsed;

    if (!parsed && options.dotenvStrict) {
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

  const sources = Array.isArray(options.sources) ? options.sources : [];

  for (const source of sources) {
    const loaded = await Promise.resolve(source.load());

    for (const [k, v] of Object.entries(loaded)) {
      if (typeof v === 'string') {
        result[k] = v;
      }
    }
  }

  if (includeProcessEnv) {
    for (const [k, v] of Object.entries(process.env)) {
      if (typeof v === 'string') {
        result[k] = v;
      }
    }
  }

  if (options.mutateProcessEnv) {
    for (const [k, v] of Object.entries(result)) {
      process.env[k] ??= v;
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
      loaded.forEach((v, k) => {
        result.set(k, v);
      });

      continue;
    }

    Object.entries(loaded).forEach(([k, v]) => {
      result.set(k, v);
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
export async function bootstrapApplication(entry: EntryModule, options?: BootstrapApplicationOptions): Promise<BunnerApplication> {
  const preloadProviders = await options?.preload?.();
  const baseProviders = [
    ...(Array.isArray(preloadProviders) ? preloadProviders : []),
    ...(Array.isArray(options?.providers) ? options.providers : []),
  ];
  const envSnapshot = await loadEnvSnapshot(options?.env);
  const mergedProviders: Provider[] = [...baseProviders];

  if (envSnapshot && !hasProviderToken(mergedProviders, ENV_SERVICE)) {
    const envService = createEnvService(envSnapshot);

    mergedProviders.push({ provide: ENV_SERVICE, useValue: envService });
  }

  const hasConfigLoaders = Array.isArray(options?.config?.loaders) && options.config.loaders.length > 0;
  const hasEnvService = hasProviderToken(mergedProviders, ENV_SERVICE);

  if (hasConfigLoaders && hasEnvService && !hasProviderToken(mergedProviders, CONFIG_SERVICE)) {
    const envService = getEnvService(mergedProviders);

    if (!envService) {
      throw new Error('EnvService provider is missing or invalid');
    }

    const configMap = await loadConfigMap({ env: envService, loaders: options.config.loaders });
    const configService = createConfigService(configMap);

    mergedProviders.push({ provide: CONFIG_SERVICE, useValue: configService });
  }

  const aotContainer = getRuntimeContext().container;
  const providedContainer = options?.container;
  const app = await createApplication(entry, {
    ...options,
    container: providedContainer ?? aotContainer,
    providers: mergedProviders,
  });

  if (mergedProviders.length > 0) {
    const scanner = new BunnerScanner(app.getContainer());

    await scanner.scan({ providers: mergedProviders });
  }

  if (Array.isArray(options?.adapters) && options.adapters.length > 0) {
    for (const adapter of options.adapters) {
      await adapter.install(app);
    }
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
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as EnvService;

  return typeof candidate.get === 'function' && typeof candidate.getOptional === 'function';
}

function getEnvService(providers: ReadonlyArray<Provider>): EnvService | undefined {
  const provider = providers.find(item => isProviderWithValue(item) && item.provide === ENV_SERVICE);

  if (!provider) {
    return undefined;
  }

  if (!isEnvService(provider.useValue)) {
    return undefined;
  }

  return provider.useValue;
}

export type { BootstrapApplicationOptions, BootstrapConfigLoadParams, BootstrapEnvOptions } from './interfaces';
export type { BootstrapAdapter, BootstrapConfigOptions } from './interfaces';
export type { BootstrapConfigLoader } from './types';
