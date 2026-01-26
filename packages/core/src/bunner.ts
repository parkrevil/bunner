import { LogLevel, type BunnerApplicationOptions } from '@bunner/common';
import { Logger } from '@bunner/logger';

import { type BunnerApplicationBaseOptions } from './application';
import { BunnerApplication } from './application/bunner-application';
import type { BunnerApplicationRuntimeOptions } from './application/interfaces';
import type { EntryModule } from './application/types';

export class Bunner {
  static apps: Map<string, BunnerApplication> = new Map();
  private static readonly logger = new Logger(Bunner.name);
  private static isShuttingDown = false;
  private static signalsInitialized = false;

  static async create(entry: EntryModule, options?: BunnerApplicationRuntimeOptions): Promise<BunnerApplication> {
    this.setupSignalHandlers();

    // In the new architecture, we treat AOT/JIT unify within the Scanner/Application.
    // Worker logic is handled by individual adapters.

    // Normalize options
    const normalizedOptions = this.normalizeOptions(options);

    if (this.apps.has(normalizedOptions.name)) {
      throw new Error(`Application with name "${normalizedOptions.name}" already exists`);
    }

    const app = new BunnerApplication(entry, normalizedOptions);

    // We do NOT call app.start() here. User must call it.
    // Use .init() if we want to bootstrap without starting adapters?
    // Usually NestJS create() returns app, then user calls listen().
    // Here user calls app.addAdapter() then app.start().

    this.apps.set(normalizedOptions.name, app);

    return Promise.resolve(app);
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
          await app.stop();
        } catch (e) {
          const meta = e instanceof Error ? e : { error: String(e) };

          Bunner.logger.error('app stop failed', meta);
        }
      }),
    ).catch(e => {
      const meta = e instanceof Error ? e : { error: String(e) };

      Bunner.logger.error('Shutdown Error', meta);
    });
  }

  private static generateApplicationDefaultName() {
    return `bunner--${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  }

  private static normalizeOptions(options?: BunnerApplicationOptions): BunnerApplicationBaseOptions {
    const { name = this.generateApplicationDefaultName(), logLevel = LogLevel.Debug, ...appOptions } = options ?? {};

    return {
      ...appOptions,
      name,
      logLevel,
    };
  }

  private static setupSignalHandlers() {
    if (this.signalsInitialized) {
      return;
    }

    const handler = async (signal: NodeJS.Signals) => {
      let exitCode = 0;

      try {
        Bunner.logger.info('🛑 Shutting down...');
        await Promise.race([
          this.shutdown(),
          new Promise((_, reject) =>
            setTimeout(() => {
              reject(new Error('shutdown timeout'));
            }, 10000),
          ),
        ]);
      } catch (e) {
        const meta = e instanceof Error ? e : { error: String(e) };

        Bunner.logger.error(`graceful shutdown failed on ${signal}`, meta);

        exitCode = 1;
      } finally {
        try {
          process.exit(exitCode);
        } catch {}
      }
    };

    const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM', 'SIGQUIT', 'SIGHUP', 'SIGUSR2'];

    signals.forEach(signal => {
      process.on(signal, handledSignal => void handler(handledSignal));
    });

    this.signalsInitialized = true;
  }
}
