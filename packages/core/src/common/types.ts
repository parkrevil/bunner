import type { BaseApplication, CreateApplicationOptions } from '../application';

/**
 * Class
 * @description The class type
 */
export type Class<T = any> = new (...args: any[]) => T;

/**
 * Bunner App Options
 * @description The options for creating a Bunner application
 * @template T - The type of the application
 * @template O - The type of the options
 */
export type BunnerApplicationOptions<T> = (T extends BaseApplication<infer O>
  ? O
  : never) &
  CreateApplicationOptions;
