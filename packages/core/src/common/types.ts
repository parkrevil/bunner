import type {
  BaseApplication,
  BunnerApplicationBaseOptions,
  CreateApplicationOptions,
} from '../application';

/**
 * Class
 * @description The class type
 */
export type Class<T = any> = new (...args: any[]) => T;

/**
 * Bunner App Options
 * @description The options for creating a Bunner application
 * @template T - The type of the application
 * @template O - The type of the options
 */
export type BunnerApplicationOptions<T> = (T extends BaseApplication<infer O>
  ? O
  : never) &
  CreateApplicationOptions;

/**
 * Bunner App Options
 * @description The options for creating a Bunner application
 * @template T - The type of the application
 * @template O - The type of the options
 */
export type BunnerApplicationNormalizedOptions<T> = (T extends BaseApplication<
  infer O
>
  ? O
  : never) &
  Required<BunnerApplicationBaseOptions>;

/**
 * Class Properties
 * @description The properties of a class that are functions
 * @template T - The type of the class
 */
export type ClassProperties<T> = {
  [K in keyof T]-?: T[K] extends (...args: any[]) => any ? K : never;
}[keyof T];

/**
 * Function Arguments
 * @description The arguments of a function
 * @template T - The type of the class
 * @template K - The key of the function
 */
export type MethodParams<T, K extends ClassProperties<T>> = T[K] extends (
  ...args: infer P
) => any
  ? [...P]
  : never;

/**
 * Function Return Type
 * @description The return type of a function
 * @template T - The type of the class
 * @template K - The key of the function
 */
export type MethodReturn<T, K extends ClassProperties<T>> = T[K] extends (
  ...args: any[]
) => infer R
  ? R
  : never;

/**
 * Function Tail Parameters (excluding first)
 * @description The parameters of a function after the first argument
 * @template T - The type of the class
 * @template K - The key of the function
 */
export type MethodTailParams<T, K extends ClassProperties<T>> = T[K] extends (
  first: any,
  ...rest: infer R
) => any
  ? [...R]
  : [];

/**
 * Function Second Parameter
 * @description The second parameter type of a function (if any)
 */
export type MethodSecondParam<T, K extends ClassProperties<T>> = T[K] extends (
  a: any,
  b: infer S,
  ...args: any[]
) => any
  ? S
  : never;

/**
 * Sync Function
 * @description A function that is not async (does not return a Promise)
 * @template T - The type of the function
 */
export type SyncFunction<T extends (...args: any[]) => unknown> =
  ReturnType<T> extends Promise<any> ? never : T;

/**
 * Any Function
 * @description A function that can be sync or async
 */
export type AnyFunction = (...args: any[]) => any;
