import type { BunnerContainer, BunnerErrorFilter, BunnerMiddleware } from '@bunner/common';

import { Container, registerRuntimeContext } from '@bunner/core';

import {
  BunnerRequest,
  BunnerResponse,
  HttpMethod,
  RequestHandler,
  RouteHandler,
  type HttpWorkerResponse,
  type RouterOptions,
  HTTP_AFTER_RESPONSE,
  HTTP_BEFORE_REQUEST,
  HTTP_BEFORE_RESPONSE,
  HTTP_ERROR_FILTER,
  HTTP_SYSTEM_ERROR_HANDLER,
} from './index';

export type HttpTestHarness = {
  readonly container: BunnerContainer;
  readonly metadataRegistry: Map<any, any>;
  readonly routeHandler: RouteHandler;
  readonly requestHandler: RequestHandler;
};

export function createHttpTestHarness(params: {
  readonly metadataRegistry: Map<any, any>;
  readonly providers: ReadonlyArray<{ readonly token: any; readonly value: unknown }>;
  readonly routerOptions?: RouterOptions;
}): HttpTestHarness {
  const { metadataRegistry, providers, routerOptions } = params;

  registerRuntimeContext({ metadataRegistry });

  const container = new Container();

  for (const p of providers) {
    container.set(p.token, () => p.value);
  }

  const routeHandler = new RouteHandler(container, metadataRegistry, new Map(), routerOptions);

  routeHandler.register();

  const requestHandler = new RequestHandler(container, routeHandler, metadataRegistry);

  return { container, metadataRegistry, routeHandler, requestHandler };
}

export function createRequest(params: {
  readonly method: HttpMethod;
  readonly url: string;
  readonly headers?: Record<string, string>;
  readonly body?: unknown;
  readonly query?: Record<string, any>;
}): BunnerRequest {
  const { method, url, headers, body, query } = params;

  return new BunnerRequest({
    httpMethod: method,
    url,
    headers: headers ?? {},
    body,
    query: query ?? {},
    params: {},
    ip: '127.0.0.1',
    ips: ['127.0.0.1'],
    isTrustedProxy: false,
  });
}

export function createResponse(req: BunnerRequest): BunnerResponse {
  return new BunnerResponse(req, { headers: new Headers(), status: 0 } as any);
}

export async function handleRequest(params: {
  readonly harness: HttpTestHarness;
  readonly method: HttpMethod;
  readonly path: string;
  readonly url: string;
  readonly headers?: Record<string, string>;
  readonly body?: unknown;
  readonly query?: Record<string, any>;
}): Promise<{ readonly workerResponse: HttpWorkerResponse; readonly req: BunnerRequest; readonly res: BunnerResponse }> {
  const { harness, method, path, url, headers, body, query } = params;
  const req = createRequest({ method, url, headers, body, query });
  const res = createResponse(req);
  const workerResponse = await harness.requestHandler.handle(req, res, method, path);

  return { workerResponse, req, res };
}

export function withGlobalMiddlewares(params: {
  readonly beforeRequest?: ReadonlyArray<BunnerMiddleware>;
  readonly beforeResponse?: ReadonlyArray<BunnerMiddleware>;
  readonly afterResponse?: ReadonlyArray<BunnerMiddleware>;
  readonly errorFilters?: ReadonlyArray<BunnerErrorFilter | null>;
  readonly systemErrorHandler?: unknown;
}): ReadonlyArray<{ readonly token: any; readonly value: unknown }> {
  const providers: Array<{ token: any; value: unknown }> = [];

  if (params.beforeRequest) {
    providers.push({ token: HTTP_BEFORE_REQUEST, value: [...params.beforeRequest] });
  }

  if (params.beforeResponse) {
    providers.push({ token: HTTP_BEFORE_RESPONSE, value: [...params.beforeResponse] });
  }

  if (params.afterResponse) {
    providers.push({ token: HTTP_AFTER_RESPONSE, value: [...params.afterResponse] });
  }

  if (params.errorFilters) {
    providers.push({ token: HTTP_ERROR_FILTER, value: [...params.errorFilters] });
  }

  if (params.systemErrorHandler) {
    providers.push({ token: HTTP_SYSTEM_ERROR_HANDLER, value: params.systemErrorHandler });
  }

  return providers;
}
