import type { LogLevel } from '../common';

/**
 * Create Bunner Application Options
 * @description The options for creating a Bunner application
 */
export interface CreateApplicationOptions {
  name?: string;
  logLevel?: LogLevel;
  workers?: number | 'full' | 'half';
  queueCapacity?: number;
}

/**
 * Bunner Application Base Options
 * @description The base options for a Bunner application
 */
export interface BunnerApplicationBaseOptions {
  name: string;
  logLevel: LogLevel;
  workers: number;
  queueCapacity: number;
}

/**
 * Root Module File Interface
 * @description Represents the root module file with its path and class name.
 */
export interface RootModuleFile {
  path: string;
  className: string;
}

/**
 * Base Module Interface
 * @description Represents a base module in the application.
 */
export interface BunnerModule {}
