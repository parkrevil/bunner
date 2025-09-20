import { type BaseApplication, type BaseModule } from './application';
import type { BunnerApplicationOptions, Class } from './common';

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
  static async create<T extends BaseApplication>(
    appConstructor: Class<T>,
    rootModule: Class<BaseModule>,
    options?: BunnerApplicationOptions<T>,
  ) {
    this.setupSignalHandlers();

    const { name = this.generateApplicationDefaultName(), ...appOptions } =
      options ?? ({} as BunnerApplicationOptions<T>);

    if (this.apps.has(name)) {
      throw new Error(`Application with name "${name}" already exists`);
    }

    const app = new appConstructor(rootModule, appOptions);
    await app.init();

    this.apps.set(name, app);

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
