import type { ClassProperties, MethodParams, MethodSecondParam } from '../common';

export type ClusterWorkerId = number;

export type ClusterInitParams<T> = MethodSecondParam<T, Extract<'init', ClassProperties<T>>> | undefined;

/**
 * Bootstrap parameters for a worker
 * @description The type for the bootstrap parameters
 */
export type ClusterBootstrapParams<T> = MethodParams<T, Extract<'bootstrap', ClassProperties<T>>>[0] | undefined;
