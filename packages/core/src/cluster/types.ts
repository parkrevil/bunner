import type { BunnerValue } from '@bunner/common';

export type ClusterWorkerId = number;

export type RpcArg = BunnerValue;

export type RpcArgs = ReadonlyArray<RpcArg>;

export type RpcResult = BunnerValue | Promise<BunnerValue>;

export type RpcCallable = (...args: RpcArgs) => RpcResult;

export type ClusterInitParams<_T> = BunnerValue | undefined;

/**
 * Bootstrap parameters for a worker
 * @description The type for the bootstrap parameters
 */
export type ClusterBootstrapParams<_T> = BunnerValue | undefined;

export type Promisified<T extends Record<string, RpcCallable>> = {
  [K in keyof T]: (...args: RpcArgs) => Promise<Awaited<RpcResult>>;
};
