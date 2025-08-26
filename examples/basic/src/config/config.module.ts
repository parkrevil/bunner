import { Module } from '../../../../src';

export interface AppConfig {
  name: string;
  version: string;
}

export const CONFIG_TOKEN = Symbol.for('AppConfig');
export const CONFIG_ASYNC_TOKEN = Symbol.for('AppConfigAsync');

@Module({
  providers: [],
  exports: [CONFIG_TOKEN],
})
export class ConfigModule { }

export class ConfigModuleFactory {
  static forRoot(config: AppConfig) {
    return (ConfigModule as any).forRoot({
      providers: [
        { provide: CONFIG_TOKEN, useValue: config },
      ],
      exports: [CONFIG_TOKEN],
    });
  }

  static forRootAsync(load: () => Promise<AppConfig>) {
    return (ConfigModule as any).forRootAsync(async () => ({
      providers: [
        { provide: CONFIG_ASYNC_TOKEN, useFactory: async () => await load() },
      ],
      exports: [CONFIG_ASYNC_TOKEN],
    }));
  }
}


