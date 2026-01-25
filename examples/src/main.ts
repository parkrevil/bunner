import { LogLevel } from '@bunner/common';
import { bootstrapApplication } from '@bunner/core';
import { bunnerHttpAdapter } from '@bunner/http-adapter';

import type { SomeConfig } from './core/config/some-config';

import { rootModule } from './__module__';
import { ConfigNamespace } from './core/config/config-namespace';
import { SomeConfig as SomeConfigImpl } from './core/config/some-config';

await bootstrapApplication(rootModule, {
  name: 'examples',
  logLevel: LogLevel.Debug,
  workers: 6,
  env: {
    dotenvFile: '.env',
    includeProcessEnv: true,
  },
  config: {
    loaders: [
      ({ env }) => {
        return {
          [ConfigNamespace.USER_HTTP]: new SomeConfigImpl({
            host: env.get('USER_HTTP_HOST', '0.0.0.0'),
            port: env.getInt('USER_HTTP_PORT', 5001),
          }),
          [ConfigNamespace.ADMIN_HTTP]: new SomeConfigImpl({
            host: env.get('ADMIN_HTTP_HOST', '0.0.0.0'),
            port: env.getInt('ADMIN_HTTP_PORT', 5002),
          }),
        };
      },
    ],
  },
  adapters: [
    bunnerHttpAdapter(configService => {
      const httpConfig = configService.get<SomeConfig>(ConfigNamespace.USER_HTTP);

      return {
        name: 'user-api-server',
        workers: 1,
        port: httpConfig.get('port', 5001),
        host: httpConfig.get('host', '0.0.0.0'),
      };
    }),
    bunnerHttpAdapter(configService => {
      const httpConfig = configService.get<SomeConfig>(ConfigNamespace.ADMIN_HTTP);

      return {
        name: 'admin-api-server',
        workers: 1,
        port: httpConfig.get('port', 5002),
        host: httpConfig.get('host', '0.0.0.0'),
      };
    }),
  ],
});
