/**
 * Create Bunner Application Options
 * @description The options for creating a Bunner application
 */
export interface CreateApplicationOptions {
  name?: string;
}

/**
 * Root Module File Interface
 * @description Represents the root module file with its path and class name.
 */
export interface RootModuleFile {
  path: string;
  className: string;
}
