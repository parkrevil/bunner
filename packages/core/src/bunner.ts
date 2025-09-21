import {
  type BaseApplication,
  type BunnerApplicationBaseOptions,
  type BunnerModule,
  type CreateApplicationOptions,
} from './application';
import { LogLevel, type BunnerApplicationOptions, type Class } from './common';
import { BunnerError } from './errors';
import { MetadataKey } from './injector';

/**
 * Bunner class
 */
export class Bunner {
  static apps: Map<string, BaseApplication> = new Map();
  private static isShuttingDown = false;
  private static signalsInitialized = false;

  /**
   * Create a new Bunner application
   * @param type - The type of the application
   * @returns The Bunner application
   */
  static async create<TOpts, T extends BaseApplication<TOpts>>(
    appCls: Class<T>,
    rootModuleCls: Class<BunnerModule>,
    options?: BunnerApplicationOptions<T>,
  ) {
    this.setupSignalHandlers();

    const rootModuleMetadata = Reflect.getMetadata(
      MetadataKey.RootModule,
      rootModuleCls,
    );

    if (!rootModuleMetadata) {
      throw new BunnerError(
        `Root module "${rootModuleCls.name}" is missing @RootModule decorator`,
      );
    }

    const rootModuleFile = Bun.file(rootModuleMetadata.path);

    if (!(await rootModuleFile.exists())) {
      throw new BunnerError(
        `Root module file "${rootModuleMetadata.path}" does not exist`,
      );
    }

    const normalizedOptions = this.normalizeOptions<T, TOpts>(options);

    if (this.apps.has(normalizedOptions.name)) {
      throw new Error(
        `Application with name "${normalizedOptions.name}" already exists`,
      );
    }

    const app = new appCls(
      {
        path: rootModuleMetadata.path,
        className: rootModuleCls.name,
      },
      normalizedOptions,
    );

    await app.init();

    this.apps.set(normalizedOptions.name, app);

    return app;
  }

  /**
   * Get all applications
   * @returns applications
   */
  static getApplications() {
    return Object.fromEntries(this.apps.entries());
  }

  /**
   * Get an application by name
   * @param name - The name of the application
   * @returns The application
   */
  static getApplication(name: string) {
    return this.apps.get(name);
  }

  /**
   * Shutdown all applications
   */
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
          console.error('[Bunner] app shutdown failed:', e);
        }
      }),
    ).catch(console.error);
  }

  /**
   * Generate a default name for an application
   * @returns The default name
   */
  private static generateApplicationDefaultName() {
    return `bunner--${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  }

  /**
   * Normalize application options
   * @param options The application options
   * @returns The normalized options
   */
  private static normalizeOptions<
    T extends BaseApplication<any>,
    O = T extends BaseApplication<infer OO> ? OO : never,
  >(options?: BunnerApplicationOptions<T>): O & BunnerApplicationBaseOptions {
    const {
      name = this.generateApplicationDefaultName(),
      logLevel = LogLevel.Debug,
      queueCapacity = 8192,
      workers: workersInput = Math.floor(navigator.hardwareConcurrency / 2) ??
        1,
      ...appOptions
    } = (options ?? {}) as O & CreateApplicationOptions;
    let workers = workersInput;

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

  /**
   * Setup OS signal handlers (idempotent)
   */
  private static setupSignalHandlers() {
    if (this.signalsInitialized) {
      return;
    }

    const handler = async (signal: string) => {
      let exitCode = 0;

      try {
        console.log('🛑 Shutting down...');

        await Promise.race([
          this.shutdown(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('shutdown timeout')), 10000),
          ),
        ]);
      } catch (e) {
        console.error(`[Bunner] graceful shutdown failed on ${signal}:`, e);

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
