import type { BunnerApplication } from './bunner-application';
import type { ClassType, CreateApplicationOptions } from './types';

/**
 * Bunner class
 */
export class Bunner {
  /**
   * The applications map
   */
  static apps: Map<string, BunnerApplication> = new Map();

  /**
   * Create a new Bunner application
   * @param type - The type of the application
   * @returns The Bunner application
   */
  static async createApplication<T extends BunnerApplication>(appConstructor: ClassType<T>, module: ClassType<any>, options?: CreateApplicationOptions<T>) {
    const {
      name = this.generateApplicationDefaultName(),
    } = options ?? {} as CreateApplicationOptions<T>;

    if (this.apps.has(name)) {
      throw new Error(`Application with name "${name}" already exists`);
    }

    const app = new appConstructor();

    this.apps.set(name, app);

    await app.bootstrap(module);

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
   * Shutdown an application
   * @param name - The name of the application
   * @param force - Whether to force the application to stop
   */
  static async shutdownApplication(name: string, force = false) {
    const app = this.getApplication(name);

    if (!app) {
      throw new Error(`Application with name "${name}" not found`);
    }

    await app.shutdown(force);
  }

  /**
   * Shutdown all applications
   * @param force - Whether to force the applications to stop
   */
  static async shutdownAll(force = false) {
    const apps = Array.from(this.apps.values());

    await Promise.all(apps.map(app => app.shutdown(force))).catch(console.error);
  }

  /**
   * Generate a default name for an application
   * @returns The default name
   */
  private static generateApplicationDefaultName() {
    return `bunner--${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  }
}
