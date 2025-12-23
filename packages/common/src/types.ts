import type { ProviderUseValue, ProviderUseClass, ProviderUseExisting, ProviderUseFactory } from './interfaces';

export type Class<T = any> = new (...args: any[]) => T;

export type ProviderScope = 'singleton' | 'transient' | 'request';

export type Provider = Class | ProviderUseValue | ProviderUseClass | ProviderUseExisting | ProviderUseFactory;

export type ClassProperties<T> = {
  [K in keyof T]-?: T[K] extends (...args: any[]) => any ? K : never;
}[keyof T];

export type MethodParams<T, K extends ClassProperties<T>> = T[K] extends (...args: infer P) => any ? [...P] : never;

export type MethodReturn<T, K extends ClassProperties<T>> = T[K] extends (...args: any[]) => infer R ? R : never;

export type MethodTailParams<T, K extends ClassProperties<T>> = T[K] extends (first: any, ...rest: infer R) => any ? [...R] : [];

export type MethodSecondParam<T, K extends ClassProperties<T>> = T[K] extends (a: any, b: infer S, ...args: any[]) => any
  ? S
  : never;

export type SyncFunction<T extends (...args: any[]) => unknown> = ReturnType<T> extends Promise<any> ? never : T;

export type AnyFunction = (...args: any[]) => any;
