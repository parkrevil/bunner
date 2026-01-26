import type {
  BunnerErrorFilter,
  BunnerMiddleware,
  Class,
  Context,
  ErrorFilterToken,
  MiddlewareRegistration,
  MiddlewareToken,
  ProviderToken,
} from '@bunner/common';
import type { CookieMap } from 'bun';

import type { BunnerRequest } from './bunner-request';
import type { BunnerResponse } from './bunner-response';
import type { RouteHandlerEntry } from './interfaces';

export type RouteKey = number;

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD';

export type RequestParamMap = Record<string, string | undefined>;

export type RequestQueryMap = Record<string, string | string[] | undefined>;

export type RequestBodyValue =
  | string
  | number
  | boolean
  | null
  | Record<string, string | number | boolean | null>
  | Array<string | number | boolean | null>;

export type ResponseBodyValue = HttpWorkerResponseBody | RequestBodyValue;

export interface BunnerRequestInit {
  readonly url: string;
  readonly httpMethod: HttpMethod;
  readonly headers: HeadersInit;
  readonly requestId?: string;
  readonly params?: RequestParamMap;
  readonly query?: RequestQueryMap;
  readonly body?: RequestBodyValue;
  readonly isTrustedProxy?: boolean;
  readonly ip?: string | null;
  readonly ips?: string[];
}

export interface AdaptiveRequest {
  httpMethod: HttpMethod;
  url: string;
  headers: HeadersInit;
  body?: RequestBodyValue;
  queryParams: RequestQueryMap;
  params: RequestParamMap;
  ip: string;
  ips: string[];
  isTrustedProxy: boolean;
  query?: RequestQueryMap;
}

export type HttpWorkerResponseBody = ConstructorParameters<typeof Response>[0];

export type RouteHandlerArgument =
  | BunnerRequest
  | BunnerResponse
  | RequestBodyValue
  | RequestParamMap
  | RequestQueryMap
  | Headers
  | CookieMap
  | bigint
  | symbol
  | null
  | undefined;

export type RouteHandlerResult = BunnerResponse | Response | RequestBodyValue | bigint | null | undefined | void;

export type RouteHandlerValue = RouteHandlerArgument;

export type RouteHandlerFunction = (...args: readonly RouteHandlerArgument[]) => RouteHandlerResult | Promise<RouteHandlerResult>;

export type ControllerInstance = Record<string, RouteHandlerValue | RouteHandlerFunction>;

export type ContainerInstance =
  | ControllerInstance
  | BunnerMiddleware
  | BunnerErrorFilter
  | RouteHandlerValue
  | RouteHandlerFunction
  | null
  | undefined;

export type ControllerConstructor = Class<ControllerInstance>;

export type HttpContextValue =
  | BunnerRequest
  | BunnerResponse
  | RequestBodyValue
  | RequestParamMap
  | RequestQueryMap
  | Headers
  | CookieMap
  | string
  | number
  | boolean
  | bigint
  | symbol
  | null
  | undefined;

export type HttpContextConstructor<TContext> = new (...args: readonly HttpContextValue[]) => TContext;

export type MetadataRegistryKey =
  | ControllerConstructor
  | (new (...args: readonly ContainerInstance[]) => BunnerErrorFilter)
  | (new (...args: readonly ContainerInstance[]) => BunnerMiddleware);

export interface TokenRecord {
  readonly __bunner_ref?: string;
  readonly __bunner_forward_ref?: string;
  readonly name?: string;
}

export interface TokenCarrier {
  readonly token: ProviderToken;
}

export type DecoratorArgument =
  | ProviderToken
  | TokenRecord
  | TokenCarrier
  | MiddlewareToken
  | MiddlewareRegistration
  | ErrorFilterToken
  | ErrorConstructor
  | string
  | number
  | boolean
  | bigint
  | symbol
  | null
  | undefined;

export type ParamTypeReference = ProviderToken;

export type LazyParamTypeFactory = () => ParamTypeReference;

export type RouteParamType = ParamTypeReference;

export type RouteParamValue = RouteHandlerArgument;

export type RouteParamKind =
  | 'body'
  | 'param'
  | 'params'
  | 'query'
  | 'queries'
  | 'header'
  | 'headers'
  | 'cookie'
  | 'cookies'
  | 'request'
  | 'req'
  | 'response'
  | 'res'
  | 'ip';

export interface ErrorLike {
  readonly name?: string;
  readonly message?: string;
  readonly stack?: string;
}

export type SystemError = Error | ErrorLike | string | number | boolean;

export interface SystemErrorHandlerLike {
  handle(error: SystemError, ctx: Context): void | Promise<void>;
}

export interface ErrorHandlingStageParams {
  readonly error: SystemError;
  readonly stage: string;
  readonly allowBody: boolean;
}

export interface ErrorFilterRunParams {
  readonly error: SystemError;
  readonly ctx: Context;
  readonly entry?: RouteHandlerEntry;
}

export interface ErrorFilterRunResult {
  readonly originalError: SystemError;
  readonly currentError: SystemError;
}

export interface ShouldCatchParams {
  readonly error: SystemError;
  readonly filter: BunnerErrorFilter;
}

export interface MatchCatchArgumentParams {
  readonly error: SystemError;
  readonly arg: DecoratorArgument;
}

export interface ResolveTokenOptions {
  readonly strict?: boolean;
}

export type MiddlewareOptions = Record<string, string | number | boolean | null | undefined>;

export type DecoratorTarget = Record<string, string | number | boolean | symbol | null | undefined>;

export type DecoratorPropertyKey = string | symbol;

export type RouteDecoratorArgument = string | MiddlewareOptions | undefined;

export interface DecoratorMetadata {
  readonly name: string;
  readonly arguments?: readonly DecoratorArgument[];
}

export interface ConstructorParamMetadata {
  readonly type?: ParamTypeReference;
  readonly decorators?: readonly DecoratorMetadata[];
}

export interface ParameterMetadata {
  readonly name?: string;
  readonly type?: ParamTypeReference;
  readonly decorators?: readonly DecoratorMetadata[];
}

export interface MethodMetadata {
  readonly name: string;
  readonly decorators?: readonly DecoratorMetadata[];
  readonly parameters?: readonly ParameterMetadata[];
}

export interface ClassMetadata {
  readonly className?: string;
  readonly decorators?: readonly DecoratorMetadata[];
  readonly methods?: readonly MethodMetadata[];
  readonly constructorParams?: readonly ConstructorParamMetadata[];
}

export interface MatchResult {
  readonly entry: RouteHandlerEntry;
  readonly params: Record<string, string | undefined>;
}

export interface InternalRouteDefinition {
  readonly method: string;
  readonly path: string;
  readonly handler: RouteHandlerFunction;
}
