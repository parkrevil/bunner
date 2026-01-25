export type AnyValue = string | number | boolean | bigint | symbol | null | undefined | object | Function;

export type AnyFunction = (...args: AnyValue[]) => AnyValue;

export type Class<T = object> = new (...args: readonly unknown[]) => T;

export type ClassProperties<T> = {
  [K in keyof T]-?: T[K] extends (...args: AnyValue[]) => AnyValue ? K : never;
}[keyof T];

export type MethodParams<T, K extends ClassProperties<T>> = T[K] extends (...args: infer P) => AnyValue ? [...P] : never;

export type MethodReturn<T, K extends ClassProperties<T>> = T[K] extends (...args: AnyValue[]) => infer R ? R : never;

export type MethodTailParams<T, K extends ClassProperties<T>> = T[K] extends (first: AnyValue, ...rest: infer R) => AnyValue
  ? [...R]
  : [];

export type MethodSecondParam<T, K extends ClassProperties<T>> = T[K] extends (
  a: AnyValue,
  b: infer S,
  ...args: AnyValue[]
) => AnyValue
  ? S
  : never;

export type SyncFunction<T extends AnyFunction> = ReturnType<T> extends Promise<AnyValue> ? never : T;

export type PrimitiveValue = string | number | boolean | bigint | symbol | null | undefined;

export type PrimitiveArray = Array<PrimitiveValue>;

export type PrimitiveRecord = Record<string, PrimitiveValue | PrimitiveArray>;

export type Callable = (...args: PrimitiveArray) => PrimitiveValue;

export type Constructor<T = PrimitiveRecord> = new (...args: PrimitiveArray) => T;

export type ValueLike = PrimitiveValue | PrimitiveArray | PrimitiveRecord | Callable | Constructor;

export type ForwardRefFactory = () => ValueLike;
