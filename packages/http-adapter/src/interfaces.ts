import type {
  BunnerApplicationOptions,
  BunnerContainer,
  BunnerErrorFilter,
  BunnerMiddleware,
  Class,
  ErrorFilterToken,
  MiddlewareRegistration,
  MiddlewareToken,
} from '@bunner/common';
import type { RuntimeContext } from '@bunner/core';

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
  reusePort?: boolean;
  middlewares?: HttpMiddlewareRegistry;
  errorFilters?: readonly ErrorFilterToken[];
}

export type InternalRouteMethod = 'GET';

export type InternalRouteHandler = (...args: readonly RouteHandlerArgument[]) => RouteHandlerResult;

export interface InternalRouteEntry {
  readonly method: InternalRouteMethod;
  readonly path: string;
  readonly handler: InternalRouteHandler;
}

export interface BunnerHttpServerBootOptions extends BunnerHttpServerOptions {
  readonly options?: BunnerHttpServerOptions;
  readonly metadata?: RuntimeContext['metadataRegistry'];
  readonly scopedKeys?: RuntimeContext['scopedKeys'];
  readonly internalRoutes?: readonly InternalRouteEntry[];
}

export interface HttpAdapterStartContext {
  readonly container: BunnerContainer;
  readonly entryModule?: Class;
}

export interface BunnerHttpInternalChannel {
  get(path: string, handler: InternalRouteHandler): void;
}

export type BunnerHttpInternalHost = Record<symbol, BunnerHttpInternalChannel | undefined>;

export interface WorkerInitParams {
  rootModuleClassName: string;
  options: WorkerOptions;
}

export interface WorkerOptions {}

export interface HttpWorkerEntryModule {
  readonly path?: string;
  readonly className: string;
  readonly manifestPath?: string;
}

export interface HttpWorkerInitParams {
  readonly entryModule: HttpWorkerEntryModule;
  readonly options: BunnerHttpServerOptions;
}

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
