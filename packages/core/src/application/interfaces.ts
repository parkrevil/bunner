import type { BaseApplication } from './base-application';

/**
 * Bunner Root Module
 * @description The root module for the Bunner application
 */
export interface BaseModule {
  configure?(app: BaseApplication): void | Promise<void>;
  registerMiddlewares?(app: BaseApplication): void | Promise<void>;
}

/**
 * Create Bunner Application Options
 * @description The options for creating a Bunner application
 */
export interface CreateApplicationOptions {
  name?: string;
}
