import type {
  AnyFunction,
  BunnerApplicationOptions,
  BunnerErrorFilter,
  BunnerMiddleware,
  ErrorFilterToken,
  MiddlewareRegistration,
  MiddlewareToken,
  Context,
} from '@bunner/common';

import type { RouteHandlerParamType } from './decorators';

export enum HttpMiddlewareLifecycle {
  BeforeRequest = 'BeforeRequest',
  AfterRequest = 'AfterRequest',
  BeforeHandler = 'BeforeHandler',
  BeforeResponse = 'BeforeResponse',
  AfterResponse = 'AfterResponse',
}

export type MiddlewareRegistrationInput<TOptions = unknown> = MiddlewareRegistration<TOptions> | MiddlewareToken<TOptions>;

export type HttpMiddlewareRegistry = Partial<Record<HttpMiddlewareLifecycle, readonly MiddlewareRegistrationInput[]>>;

export interface BunnerHttpServerOptions extends BunnerApplicationOptions {
  port?: number;
  bodyLimit?: number;
  trustProxy?: boolean;
  workers?: number;
  middlewares?: HttpMiddlewareRegistry;
  errorFilters?: readonly ErrorFilterToken[];
}

export interface WorkerInitParams {
  rootModuleClassName: string;
  options: WorkerOptions;
}

export interface WorkerOptions {}

export interface HttpWorkerResponse {
  body: any;
  init: ResponseInit;
}

export interface RouteHandlerEntry {
  handler: AnyFunction;
  paramType: RouteHandlerParamType[];
  paramRefs: any[];
  controllerClass: any;
  methodName: string;
  middlewares: BunnerMiddleware[];
  errorFilters: BunnerErrorFilter[];
  paramFactory: (req: any, res: any) => Promise<any[]>;
}

export abstract class SystemErrorHandler {
  public abstract handle(error: unknown, ctx: Context): void | Promise<void>;
}

export interface ArgumentMetadata {
  type: 'body' | 'query' | 'param' | 'custom';
  metatype?: any;
  data?: string;
}

export interface PipeTransform<T = any, R = any> {
  transform(value: T, metadata: ArgumentMetadata): R | Promise<R>;
}
