import type { ConfigService } from '@bunner/common';
import { CONFIG_SERVICE } from '@bunner/common';
import type { BootstrapAdapter } from '@bunner/core';

import { BunnerHttpAdapter } from './bunner-http-adapter';
import type { BunnerHttpServerOptions } from './interfaces';

export type BunnerHttpAdapterBootstrapConfig = BunnerHttpServerOptions & {
  readonly name: string;
  readonly protocol?: string;
};

export function bunnerHttpAdapter(resolve: (configService: ConfigService) => BunnerHttpAdapterBootstrapConfig): BootstrapAdapter {
  return {
    install(app) {
      const container = app.getContainer();
      const tokenName =
        typeof CONFIG_SERVICE === 'symbol' ? (CONFIG_SERVICE.description ?? String(CONFIG_SERVICE)) : String(CONFIG_SERVICE);
      let configService: ConfigService | undefined;

      if (container.has(CONFIG_SERVICE)) {
        configService = container.get<ConfigService>(CONFIG_SERVICE);
      }

      if (container.has(tokenName)) {
        configService = container.get<ConfigService>(tokenName);
      }

      if (!configService) {
        for (const key of container.keys()) {
          if (typeof key === 'string' && key.endsWith(`::${tokenName}`)) {
            configService = container.get<ConfigService>(key);
            break;
          }
        }
      }

      if (!configService) {
        throw new Error(
          `ConfigService is not available. Provide ${tokenName} via bootstrapApplication({ config: { loaders } }) or custom providers.`,
        );
      }

      const config = resolve(configService);
      const { name, protocol, ...serverOptions } = config;
      const adapter = new BunnerHttpAdapter(serverOptions);

      app.addAdapter(adapter, {
        name,
        protocol: protocol ?? 'http',
      });
    },
  };
}
