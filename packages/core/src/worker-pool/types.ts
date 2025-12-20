import type { ClassProperties, MethodParams, MethodSecondParam } from '../common';

export type WorkerId = number;

export type InitParams<T> = MethodSecondParam<T, Extract<'init', ClassProperties<T>>> | undefined;

/**
 * Bootstrap parameters for a worker
 * @description The type for the bootstrap parameters
 */
export type BootstrapParams<T> = MethodParams<T, Extract<'bootstrap', ClassProperties<T>>>[0] | undefined;
