import type {
  BeforeStart,
  BunnerAdapter,
  ConfigService,
  Configurer,
  EnvService,
  OnDestroy,
  OnInit,
  OnShutdown,
  OnStart,
} from './interfaces';

export type BunnerPrimitive = string | number | boolean | bigint | symbol | null | undefined;

export type ErrorConstructorLike = new (...args: ReadonlyArray<BunnerValue>) => Error;

export type ErrorToken =
  | ErrorConstructorLike
  | StringConstructor
  | NumberConstructor
  | BooleanConstructor
  | BigIntConstructor
  | SymbolConstructor;

export interface BunnerArray extends Array<BunnerValue> {}

export interface BunnerRecord extends Record<string, BunnerValue> {}

export interface BunnerConstructorDescriptor {
  readonly name?: string;
}

export interface BunnerInstance {
  readonly constructor: BunnerConstructorDescriptor;
}

export type BunnerValue =
  | BunnerPrimitive
  | BunnerRecord
  | BunnerArray
  | BunnerInstance
  | ClassToken
  | Callable
  | BunnerAdapter
  | ConfigService
  | Configurer
  | EnvService
  | OnInit
  | BeforeStart
  | OnStart
  | OnShutdown
  | OnDestroy;

export interface BunnerFunction {
  (...args: readonly BunnerValue[]): BunnerValue | void;
}

export interface Class<T = BunnerValue> {
  new (...args: ReadonlyArray<BunnerValue>): T;
}

export interface ClassToken<T = BunnerValue> {
  new (...args: ReadonlyArray<BunnerValue>): T;
}

export type ClassProperties<T> = {
  [K in keyof T]-?: T[K] extends (...args: BunnerValue[]) => BunnerValue ? K : never;
}[keyof T];

export type MethodParams<T, K extends ClassProperties<T>> = T[K] extends (...args: infer P) => BunnerValue | void ? [...P] : never;

export type MethodReturn<T, K extends ClassProperties<T>> = T[K] extends (...args: BunnerValue[]) => infer R ? R : never;

export type MethodTailParams<T, K extends ClassProperties<T>> = T[K] extends (first: BunnerValue, ...rest: infer R) => BunnerValue | void
  ? [...R]
  : [];

export type MethodSecondParam<T, K extends ClassProperties<T>> = T[K] extends (
  a: BunnerValue,
  b: infer S,
  ...args: BunnerValue[]
) => BunnerValue | void
  ? S
  : never;

export type SyncFunction<T extends BunnerFunction> = ReturnType<T> extends Promise<BunnerValue> ? never : T;

export type PrimitiveValue = string | number | boolean | bigint | symbol | null | undefined;

export type PrimitiveArray = Array<PrimitiveValue>;

export type PrimitiveRecord = Record<string, PrimitiveValue | PrimitiveArray>;

export interface Callable {
  (...args: ReadonlyArray<BunnerValue>): BunnerValue | void;
}

export type Constructor<T = BunnerValue> = new (...args: ReadonlyArray<BunnerValue>) => T;

export type ValueLike = PrimitiveValue | PrimitiveArray | PrimitiveRecord | Callable;

export type ForwardRefFactory = () => BunnerValue;

export type DecoratorTarget = Class | Record<string, ValueLike>;
