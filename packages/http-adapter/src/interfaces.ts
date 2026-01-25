import type {
  BunnerApplicationOptions,
  BunnerErrorFilter,
  BunnerMiddleware,
  ErrorFilterToken,
  MiddlewareRegistration,
  MiddlewareToken,
  Context,
} from '@bunner/common';

import type { BunnerRequest } from './bunner-request';
import type { BunnerResponse } from './bunner-response';
import type { RouteHandlerParamType } from './decorators';
import type {
  ControllerConstructor,
  HttpWorkerResponseBody,
  MiddlewareOptions,
  RouteHandlerFunction,
  RouteParamType,
  RouteParamValue,
} from './types';

export enum HttpMiddlewareLifecycle {
  BeforeRequest = 'BeforeRequest',
  AfterRequest = 'AfterRequest',
  BeforeHandler = 'BeforeHandler',
  BeforeResponse = 'BeforeResponse',
  AfterResponse = 'AfterResponse',
}

export type MiddlewareRegistrationInput<TOptions = MiddlewareOptions> =
  | MiddlewareRegistration<TOptions>
  | MiddlewareToken<TOptions>;

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
  readonly body: HttpWorkerResponseBody;
  readonly init: ResponseInit;
}

export interface RouteHandlerEntry {
  readonly handler: RouteHandlerFunction;
  readonly paramType: RouteHandlerParamType[];
  readonly paramRefs: readonly RouteParamType[];
  readonly controllerClass: ControllerConstructor | null;
  readonly methodName: string;
  readonly middlewares: BunnerMiddleware[];
  readonly errorFilters: BunnerErrorFilter[];
  readonly paramFactory: (req: BunnerRequest, res: BunnerResponse) => Promise<readonly RouteParamValue[]>;
}

export interface ArgumentMetadata {
  type: 'body' | 'query' | 'param' | 'custom';
  metatype?: RouteParamType;
  data?: string;
}

export interface PipeTransform<T = RouteParamValue, R = RouteParamValue> {
  transform(value: T, metadata: ArgumentMetadata): R | Promise<R>;
}
