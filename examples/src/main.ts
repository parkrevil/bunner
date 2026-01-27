import type { ConfigService, ValueLike } from '@bunner/common';
import { LogLevel } from '@bunner/common';
import { bootstrapApplication } from '@bunner/core';
import { bunnerHttpAdapter } from '@bunner/http-adapter';

import { rootModule } from './__module__';
import { ConfigNamespace } from './core/config/config-namespace';
import type { HttpConfig } from './core/config/types';

const isHttpConfig = (value: ValueLike): value is HttpConfig => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const hostValue = value.host;
  const portValue = value.port;

  return typeof hostValue === 'string' && typeof portValue === 'number';
};

const requireHttpConfig = (configService: ConfigService, namespace: string | symbol): HttpConfig => {
  const value = configService.get(namespace);

  if (isHttpConfig(value)) {
    return value;
  }

  throw new Error(`Invalid config for namespace: ${String(namespace)}`);
};

await bootstrapApplication(rootModule, {
  name: 'examples',
  logLevel: LogLevel.Debug,
  env: {
    dotenvFile: '.env',
    includeProcessEnv: true,
  },
  config: {
    loaders: [
      ({ env }) => {
        const userHttp: HttpConfig = {
          host: env.get('USER_HTTP_HOST', '0.0.0.0'),
          port: env.getInt('USER_HTTP_PORT', 5001),
        };
        const adminHttp: HttpConfig = {
          host: env.get('ADMIN_HTTP_HOST', '0.0.0.0'),
          port: env.getInt('ADMIN_HTTP_PORT', 5002),
        };

        return {
          [ConfigNamespace.USER_HTTP]: userHttp,
          [ConfigNamespace.ADMIN_HTTP]: adminHttp,
        };
      },
    ],
  },
  adapters: [
    bunnerHttpAdapter(configService => {
      const httpConfig = requireHttpConfig(configService, ConfigNamespace.USER_HTTP);

      return {
        name: 'user-api-server',
        workers: 1,
        port: httpConfig.port,
        host: httpConfig.host,
      };
    }),
    bunnerHttpAdapter(configService => {
      const httpConfig = requireHttpConfig(configService, ConfigNamespace.ADMIN_HTTP);

      return {
        name: 'admin-api-server',
        workers: 1,
        port: httpConfig.port,
        host: httpConfig.host,
      };
    }),
  ],
});
