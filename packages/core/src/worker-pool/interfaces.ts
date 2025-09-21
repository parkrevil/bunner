/**
 * Options for configuring a worker pool.
 */
export interface WorkerPoolOptions {
  script: URL;
  workers?: number;
}
