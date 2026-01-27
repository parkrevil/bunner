import type {
  BunnerApplicationOptions,
  BunnerContainer,
  BunnerErrorFilter,
  BunnerMiddleware,
  BunnerValue,
  Class,
  Context,
  ErrorFilterToken,
  ProviderToken,
} from '@bunner/common';

import type { BunnerRequest } from './bunner-request';
import type { BunnerResponse } from './bunner-response';
import type { RouteHandlerParamType } from './decorators';
import type {
  ClassMetadata,
  ControllerConstructor,
  HttpMiddlewareRegistration,
  HttpMiddlewareToken,
  RouteHandlerArgument,
  RouteHandlerResult,
  HttpWorkerResponseBody,
  MetadataRegistryKey,
  MiddlewareOptions,
  RouteHandlerFunction,
  RouteParamType,
  RouteParamValue,
  SystemError,
} from './types';

export enum HttpMiddlewareLifecycle {
  BeforeRequest = 'BeforeRequest',
  AfterRequest = 'AfterRequest',
  BeforeHandler = 'BeforeHandler',
  BeforeResponse = 'BeforeResponse',
  AfterResponse = 'AfterResponse',
}

export type MiddlewareRegistrationInput<TOptions = MiddlewareOptions> =
  | HttpMiddlewareRegistration<TOptions>
  | HttpMiddlewareToken<TOptions>;

export type HttpMiddlewareRegistry = Partial<Record<string, readonly MiddlewareRegistrationInput[]>>;

export interface BunnerHttpServerOptions extends BunnerApplicationOptions {
  readonly port?: number;
  readonly bodyLimit?: number;
  readonly trustProxy?: boolean;
  readonly workers?: number;
  readonly reusePort?: boolean;
  readonly middlewares?: HttpMiddlewareRegistry;
  readonly errorFilters?: readonly ErrorFilterToken[];
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
  readonly metadata?: Map<MetadataRegistryKey, ClassMetadata>;
  readonly scopedKeys?: Map<ProviderToken, string>;
  readonly internalRoutes?: readonly InternalRouteEntry[];
  readonly middlewares?: HttpMiddlewareRegistry;
  readonly errorFilters?: readonly ErrorFilterToken[];
  readonly logger?: BunnerValue;
}

export interface HttpAdapterStartContext extends Context {
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
  readonly manifest?: HttpWorkerManifest;
}

export interface HttpWorkerInitParams {
  readonly entryModule: HttpWorkerEntryModule;
  readonly options: BunnerHttpServerOptions;
}

export interface HttpWorkerManifest {
  createContainer(): BunnerContainer;
  createMetadataRegistry?(): Map<ControllerConstructor, ClassMetadata>;
  createScopedKeysMap?(): Map<ProviderToken, string>;
  registerDynamicModules?(container: BunnerContainer): Promise<void> | void;
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
  readonly errorFilters: Array<BunnerErrorFilter<SystemError>>;
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
