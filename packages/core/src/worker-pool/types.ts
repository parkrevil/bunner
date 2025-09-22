import type {
  ClassProperties,
  MethodParams,
  MethodSecondParam,
} from '../common';

/**
 * Worker ID
 * @description The type for the worker ID
 */
export type WorkerId = number;

export type InitParams<T> =
  | MethodSecondParam<T, Extract<'init', ClassProperties<T>>>
  | undefined;

export type BootstrapParams<T> =
  | MethodParams<T, Extract<'bootstrap', ClassProperties<T>>>[0]
  | undefined;
