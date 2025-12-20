import type { Remote } from 'comlink';

export interface WorkerPoolOptions {
  script: URL;
  size: number;
}

export interface WrappedWorker<T> {
  remote: Remote<T>;
  native: Worker;
}

export interface WorkerSlot {
  active: number;
  cpu: number;
  memory: number;
  responseTime: number;
}

export interface WorkerStats {
  cpu: number;
  memory: number;
}
