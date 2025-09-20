import type { WorkerEvent } from './enums';

/**
 * Worker Pool Options Interface
 * @description Defines the options for configuring the worker pool.
 */
export interface WorkerPoolOptions {
  script: URL;
  size?: number;
}

export interface WorkerReadyMessage {
  event: WorkerEvent.Ready;
}

export interface WorkerTaskMessage<T> {
  event: WorkerEvent.Task;
  payload: T;
}

export interface WorkerErrorMessage {
  event: WorkerEvent.Error;
}

export interface WorkerDestroyMessage {
  event: WorkerEvent.Destroy;
}
