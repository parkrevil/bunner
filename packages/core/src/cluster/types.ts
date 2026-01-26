import type { ClassProperties, MethodParams, MethodSecondParam, ValueLike } from '@bunner/common';

export type ClusterWorkerId = number;

export type RpcArg = ValueLike;

export type RpcArgs = ReadonlyArray<RpcArg>;

export type RpcResult = ValueLike;

export type RpcCallable = (...args: RpcArgs) => RpcResult;

export type ClusterInitParams<T> = MethodSecondParam<T, Extract<'init', ClassProperties<T>>> | undefined;

/**
 * Bootstrap parameters for a worker
 * @description The type for the bootstrap parameters
 */
export type ClusterBootstrapParams<T> = MethodParams<T, Extract<'bootstrap', ClassProperties<T>>>[0] | undefined;

export type Promisified<T extends Record<string, RpcCallable>> = {
	[K in keyof T]: T[K] extends (...args: infer Args) => infer Result
		? (...args: Args) => Promise<Awaited<Result>>
		: T[K];
};
