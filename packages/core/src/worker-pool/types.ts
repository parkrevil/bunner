import type {
  WorkerDestroyMessage,
  WorkerErrorMessage,
  WorkerReadyMessage,
  WorkerTaskMessage,
} from './interfaces';

export type WorkerMessage<T> =
  | WorkerReadyMessage
  | WorkerTaskMessage<T>
  | WorkerErrorMessage
  | WorkerDestroyMessage;
