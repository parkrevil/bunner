import { Container, registerRuntimeContext } from '@bunner/core';

import {
  BunnerRequest,
  BunnerResponse,
  HTTP_AFTER_RESPONSE,
  HTTP_BEFORE_REQUEST,
  HTTP_BEFORE_RESPONSE,
  HTTP_ERROR_FILTER,
  HTTP_SYSTEM_ERROR_HANDLER,
} from './index';
import type {
  CreateHttpTestHarnessParams,
  CreateRequestParams,
  GlobalMiddlewaresParams,
  HandleRequestParams,
  HandleRequestResult,
  HttpTestHarness,
  TestProvider,
} from './interfaces';

export function createHttpTestHarness(params: CreateHttpTestHarnessParams): HttpTestHarness {
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

export function createRequest(params: CreateRequestParams): BunnerRequest {
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
  return new BunnerResponse(req, new Headers());
}

export async function handleRequest(params: HandleRequestParams): Promise<HandleRequestResult> {
  const { harness, method, path, url, headers, body, query } = params;
  const req = createRequest({ method, url, headers, body, query });
  const res = createResponse(req);
  const workerResponse = await harness.requestHandler.handle(req, res, method, path);

  return { workerResponse, req, res };
}

export function withGlobalMiddlewares(params: GlobalMiddlewaresParams): ReadonlyArray<TestProvider> {
  const providers: Array<TestProvider> = [];

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
