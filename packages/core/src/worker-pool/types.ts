import type { ClassProperties, MethodParams, MethodSecondParam } from '../common';

/**
 * Worker ID
 * @description The type for the worker ID
 */
export type WorkerId = number;

/**
 * Initialization parameters for a worker
 * @description The type for the initialization parameters
 */
export type InitParams<T> = MethodSecondParam<T, Extract<'init', ClassProperties<T>>> | undefined;

/**
 * Bootstrap parameters for a worker
 * @description The type for the bootstrap parameters
 */
export type BootstrapParams<T> = MethodParams<T, Extract<'bootstrap', ClassProperties<T>>>[0] | undefined;
