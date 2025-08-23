/**
 * Constructor type for dependency injection
 */
export type Constructor<T = any> = new (...args: any[]) => T;
