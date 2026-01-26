export type BunnerPrimitive = string | number | boolean | bigint | symbol | null | undefined;

export type BunnerValue = BunnerPrimitive | BunnerRecord | BunnerArray;

export type BunnerArray = BunnerValue[];

export type BunnerRecord = Record<string, BunnerValue>;

export type BunnerFunction = (...args: readonly BunnerValue[]) => BunnerValue;

export type Class<T = BunnerValue> = new (...args: readonly BunnerValue[]) => T;

export type ClassProperties<T> = {
  [K in keyof T]-?: T[K] extends (...args: BunnerValue[]) => BunnerValue ? K : never;
}[keyof T];

export type MethodParams<T, K extends ClassProperties<T>> = T[K] extends (...args: infer P) => BunnerValue ? [...P] : never;

export type MethodReturn<T, K extends ClassProperties<T>> = T[K] extends (...args: BunnerValue[]) => infer R ? R : never;

export type MethodTailParams<T, K extends ClassProperties<T>> = T[K] extends (first: BunnerValue, ...rest: infer R) => BunnerValue
  ? [...R]
  : [];

export type MethodSecondParam<T, K extends ClassProperties<T>> = T[K] extends (
  a: BunnerValue,
  b: infer S,
  ...args: BunnerValue[]
) => BunnerValue
  ? S
  : never;

export type SyncFunction<T extends BunnerFunction> = ReturnType<T> extends Promise<BunnerValue> ? never : T;

export type PrimitiveValue = string | number | boolean | bigint | symbol | null | undefined;

export type PrimitiveArray = Array<PrimitiveValue>;

export type PrimitiveRecord = Record<string, PrimitiveValue | PrimitiveArray>;

export type Callable = (...args: PrimitiveArray) => PrimitiveValue;

export type Constructor<T = PrimitiveRecord> = new (...args: PrimitiveArray) => T;

export type ValueLike = PrimitiveValue | PrimitiveArray | PrimitiveRecord | Callable | Constructor;

export type ForwardRefFactory = () => ValueLike;

export type DecoratorTarget = Class | Record<string, ValueLike>;
