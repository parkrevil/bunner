import type { BunnerCreateWebApplicationOptions, IBunnerApplication } from './interfaces';
import type { BunnerApplicationType } from './types';
import { BunnerWebApplication } from './web-application/bunner-web-application';

/**
 * Bunner class
 */
export class Bunner {
  /**
   * The applications map
   */
  static applications: Map<string, IBunnerApplication> = new Map();

  /**
   * Create a new Bunner application
   * @param options - The options for the application
   * @returns The Bunner application
   */
  static createWebApplication(options?: BunnerCreateWebApplicationOptions) {
    const {
      name = this.generateApplicationDefaultName('web'),
    } = options ?? {};

    if (this.applications.has(name)) {
      throw new Error(`Application with name "${name}" already exists`);
    }

    const app = new BunnerWebApplication();

    this.applications.set(name, app);

    return app;
  }

  /**
   * Get all applications
   * @returns applications
   */
  static getApplications() {
    return Object.fromEntries(this.applications.entries());
  }

  /**
   * Get an application by name
   * @param name - The name of the application
   * @returns The application
   */
  static getApplication(name: string) {
    return this.applications.get(name);
  }

  /**
   * Stop an application
   * @param name - The name of the application
   * @param force - Whether to force the application to stop
   */
  static async stopApplication(name: string, force = false) {
    const app = this.getApplication(name);

    if (!app) {
      throw new Error(`Application with name "${name}" not found`);
    }

    await app.stop(force);
  }

  /**
   * Delete an application
   * @param name - The name of the application
   */
  static async deleteApplication(name: string) {
    const app = this.getApplication(name);

    if (!app) {
      throw new Error(`Application with name "${name}" not found`);
    }

    await app.stop(true);

    this.applications.delete(name);
  }

  private static generateApplicationDefaultName(type: BunnerApplicationType) {
    return `bunner-${type}-${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  }
}
