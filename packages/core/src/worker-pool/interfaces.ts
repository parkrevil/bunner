/**
 * Worker Pool Options Interface
 * @description Defines the options for configuring the worker pool.
 */
export interface WorkerPoolOptions {
  app: string;
  scripts: URL;
  size?: number;
}
