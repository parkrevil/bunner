import type { BunnerContainer, BunnerErrorFilter, BunnerMiddleware, ProviderToken } from '@bunner/common';

import type { RequestBodyValue, RequestQueryMap, SystemError } from '../src/types';
import type {
  BunnerRequest,
  BunnerResponse,
  HttpMethod,
  HttpWorkerResponse,
  RequestHandler,
  RouteHandler,
  RouterOptions,
} from './index';
import type { TestMetadataRegistry, TestProviderValue } from './types';

export interface TestProvider {
  token: ProviderToken;
  value: TestProviderValue;
}

export interface HttpTestHarness {
  container: BunnerContainer;
  metadataRegistry: TestMetadataRegistry;
  routeHandler: RouteHandler;
  requestHandler: RequestHandler;
}

export interface CreateHttpTestHarnessParams {
  metadataRegistry: TestMetadataRegistry;
  providers: ReadonlyArray<TestProvider>;
  routerOptions?: RouterOptions;
}

export interface CreateRequestParams {
  method: HttpMethod;
  url: string;
  headers?: Record<string, string>;
  body?: RequestBodyValue;
  query?: RequestQueryMap;
}

export interface HandleRequestParams {
  harness: HttpTestHarness;
  method: HttpMethod;
  path: string;
  url: string;
  headers?: Record<string, string>;
  body?: RequestBodyValue;
  query?: RequestQueryMap;
}

export interface HandleRequestResult {
  workerResponse: HttpWorkerResponse;
  req: BunnerRequest;
  res: BunnerResponse;
}

export interface GlobalMiddlewaresParams {
  beforeRequest?: ReadonlyArray<BunnerMiddleware>;
  beforeResponse?: ReadonlyArray<BunnerMiddleware>;
  afterResponse?: ReadonlyArray<BunnerMiddleware>;
  errorFilters?: ReadonlyArray<BunnerErrorFilter<SystemError> | null>;
  systemErrorHandler?: TestProviderValue;
}
