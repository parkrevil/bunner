import type { Promisified, RpcArgs, RpcCallable, RpcResult } from './types';

export interface ClusterOptions {
  script: URL;
  size: number;
}

export interface ClusterWorker<T extends Record<string, RpcCallable>> {
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

export interface RPCMessage {
  id: string;
  method: string;
  args: RpcArgs;
}

export interface RPCResponse {
  id: string;
  result?: RpcResult;
  error?: string;
}

export interface RpcPending {
  resolve(value: RpcResult): void;
  reject(error: Error): void;
}
