/**
 * Bunner Root Module
 * @description The root module for the Bunner application
 */
export interface BunnerRootModule {
  configure?(): void | Promise<void>;
  registerMiddlewares?(): void | Promise<void>;
}

/**
 * Create Bunner Application Options
 * @description The options for creating a Bunner application
 */
export interface CreateBunnerApplicationOptions {
  name?: string;
}
