import type { Promisified } from './ipc';

export interface ClusterOptions {
  script: URL;
  size: number;
}

export interface ClusterWorker<T extends object> {
  remote: Promisified<T>;
  native: Worker;
}

export interface ClusterSlot {
  active: number;
  cpu: number;
  memory: number;
  responseTime: number;
}

export interface ClusterWorkerStats {
  cpu: number;
  memory: number;
}
