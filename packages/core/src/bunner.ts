import { Logger } from '@bunner/logger';

import {
  type BaseApplication,
  type BunnerApplicationBaseOptions,
  type BunnerModule,
  type CreateApplicationOptions,
  type BunnerApplicationOptions,
} from './application';
import { LogLevel, type Class } from './common';

export class Bunner {
  static apps: Map<string, BaseApplication> = new Map();
  private static readonly logger = new Logger(Bunner.name);
  private static isShuttingDown = false;
  private static signalsInitialized = false;

  static async create<TOpts, T extends BaseApplication<TOpts>>(
    appCls: Class<T>,
    rootModuleCls: Class<BunnerModule>,
    options?: BunnerApplicationOptions,
  ) {
    this.setupSignalHandlers();

    const aotContainer = (globalThis as any).__BUNNER_CONTAINER__;
    const aotManifestPath = (globalThis as any).__BUNNER_MANIFEST_PATH__;
    const aotMetadata = (globalThis as any).__BUNNER_METADATA_REGISTRY__;

    if (!aotContainer) {
      this.logger.warn('⚠️ AOT Container not found.');
    }

    const normalizedOptions = this.normalizeOptions<T, TOpts>(options);

    if (this.apps.has(normalizedOptions.name)) {
      throw new Error(`Application with name "${normalizedOptions.name}" already exists`);
    }

    const app = new appCls(
      {
        path: 'aot-generated',
        className: rootModuleCls.name,
        container: aotContainer,
        manifestPath: aotManifestPath,
        metadata: aotMetadata,
      },
      normalizedOptions,
    );

    await app.init();

    this.apps.set(normalizedOptions.name, app);

    return app;
  }

  static getApplications() {
    return Object.fromEntries(this.apps.entries());
  }

  static getApplication(name: string) {
    return this.apps.get(name);
  }

  static async shutdown() {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;

    const apps = Array.from(this.apps.values());

    await Promise.all(
      apps.map(async app => {
        try {
          await app.shutdown(true);
        } catch (e) {
          Bunner.logger.error('app shutdown failed', e);
        }
      }),
    ).catch(e => Bunner.logger.error('Shutdown Error', e));
  }

  private static generateApplicationDefaultName() {
    return `bunner--${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  }

  private static normalizeOptions<T extends BaseApplication<any>, O = T extends BaseApplication<infer OO> ? OO : never>(
    options?: BunnerApplicationOptions,
  ): O & BunnerApplicationBaseOptions {
    const {
      name = this.generateApplicationDefaultName(),
      logLevel = LogLevel.Debug,
      queueCapacity = 8192,
      workers: workersInput = Math.floor(navigator.hardwareConcurrency / 2) ?? 1,
      ...appOptions
    } = (options ?? {}) as O & CreateApplicationOptions;

    let workers: number | 'full' | 'half' = workersInput as any;

    if (workers === 'full') {
      workers = navigator.hardwareConcurrency;
    } else if (workers === 'half') {
      workers = Math.floor(navigator.hardwareConcurrency / 2) || 1;
    }

    return {
      ...(appOptions as O),
      name,
      logLevel,
      workers,
      queueCapacity,
    };
  }

  private static setupSignalHandlers() {
    if (this.signalsInitialized) {
      return;
    }

    const handler = async (signal: string) => {
      let exitCode = 0;

      try {
        Bunner.logger.info('🛑 Shutting down...');

        await Promise.race([
          this.shutdown(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('shutdown timeout')), 10000)),
        ]);
      } catch (e) {
        Bunner.logger.error(`graceful shutdown failed on ${signal}`, e);

        exitCode = 1;
      } finally {
        try {
          process.exit(exitCode);
        } catch {}
      }
    };

    ['SIGINT', 'SIGTERM', 'SIGQUIT', 'SIGHUP', 'SIGUSR2'].forEach(sig => {
      process.on(sig, signal => void handler(signal));
    });

    this.signalsInitialized = true;
  }
}
