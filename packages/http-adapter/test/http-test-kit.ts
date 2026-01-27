import type { BunnerValue, Class, ProviderToken } from '@bunner/common';

import { Container } from '@bunner/core';

import type {
  CombinedMetadataInput,
  MetadataConstructorParam,
  MetadataDecorator,
  MetadataMethod,
  MetadataParameter,
} from '../../core/src/metadata/interfaces';
import type { MetadataArgument, MetadataTypeValue } from '../../core/src/metadata/types';
import type {
  BunnerRequestInit,
  ClassMetadata,
  ConstructorParamMetadata,
  DecoratorArgument,
  DecoratorMetadata,
  MetadataRegistryKey,
  MethodMetadata,
  ParameterMetadata,
  ParamTypeReference,
} from '../src/types';
import type {
  CreateHttpTestHarnessParams,
  CreateRequestParams,
  GlobalMiddlewaresParams,
  HandleRequestParams,
  HandleRequestResult,
  HttpTestHarness,
  TestProvider,
} from './interfaces';
import type { TestProviderValue } from './types';

import {
  BunnerRequest,
  BunnerResponse,
  HTTP_AFTER_RESPONSE,
  HTTP_BEFORE_REQUEST,
  HTTP_BEFORE_RESPONSE,
  HTTP_ERROR_FILTER,
  HTTP_SYSTEM_ERROR_HANDLER,
  RequestHandler,
  RouteHandler,
} from './index';
import { MetadataConsumer } from '../../core/src/metadata/metadata-consumer';

function createHttpTestHarness(params: CreateHttpTestHarnessParams): HttpTestHarness {
  const { metadataRegistry, providers, routerOptions } = params;
  const container = new Container();
  const runtimeRegistry = normalizeMetadataRegistry(metadataRegistry);
  const cliRegistry = new Map<Class, CombinedMetadataInput>();

  for (const [key, value] of metadataRegistry.entries()) {
    if (!isCombinedMetadataInput(value)) {
      continue;
    }

    if (typeof key !== 'function') {
      continue;
    }

    cliRegistry.set(key, value);
  }

  MetadataConsumer.registerCLIMetadata(cliRegistry);

  for (const p of providers) {
    if (!isBunnerValue(p.value)) {
      throw new Error('Invalid provider value in test harness');
    }

    container.set(p.token, () => p.value);
  }

  const scopedKeys = new Map<ProviderToken, string>();
  const routeHandler = new RouteHandler(container, runtimeRegistry, scopedKeys, routerOptions);

  routeHandler.register();

  const requestHandler = new RequestHandler(container, routeHandler, runtimeRegistry);

  return { container, metadataRegistry, routeHandler, requestHandler };
}

const isCombinedMetadataInput = (
  value: ClassMetadata | CombinedMetadataInput,
): value is CombinedMetadataInput => {
  return 'properties' in value && Array.isArray(value.properties);
};

function normalizeMetadataRegistry(
  registry: Map<MetadataRegistryKey, ClassMetadata | CombinedMetadataInput>,
): Map<MetadataRegistryKey, ClassMetadata> {
  const normalized = new Map<MetadataRegistryKey, ClassMetadata>();

  for (const [key, value] of registry.entries()) {
    const decorators = normalizeDecorators(value.decorators);
    const methods = normalizeMethods(value.methods);
    const constructorParams = normalizeConstructorParams(value.constructorParams);
    const normalizedMeta: ClassMetadata = {
      ...(value.className !== undefined ? { className: value.className } : {}),
      ...(decorators !== undefined ? { decorators } : {}),
      ...(methods !== undefined ? { methods } : {}),
      ...(constructorParams !== undefined ? { constructorParams } : {}),
    };

    normalized.set(key, normalizedMeta);
  }

  return normalized;
}

function isBunnerValue(value: TestProviderValue): value is BunnerValue {
  return (
    value === null ||
    value === undefined ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint' ||
    typeof value === 'symbol' ||
    typeof value === 'function' ||
    typeof value === 'object'
  );
}

function normalizeDecorators(
  decorators: readonly DecoratorMetadata[] | readonly MetadataDecorator[] | undefined,
): readonly DecoratorMetadata[] | undefined {
  if (!decorators) {
    return undefined;
  }

  return decorators.map(decorator => {
    const args = normalizeDecoratorArguments(decorator.arguments);

    if (args !== undefined) {
      return { name: decorator.name, arguments: args };
    }

    return { name: decorator.name };
  });
}

function normalizeMethods(
  methods: readonly MethodMetadata[] | readonly MetadataMethod[] | undefined,
): readonly MethodMetadata[] | undefined {
  if (!methods) {
    return undefined;
  }

  return methods.map(method => {
    const decorators = normalizeDecorators(method.decorators);
    const parameters = normalizeParameters(method.parameters);

    return {
      name: method.name ?? '',
      ...(decorators !== undefined ? { decorators } : {}),
      ...(parameters !== undefined ? { parameters } : {}),
    };
  });
}

function normalizeParameters(
  parameters: readonly ParameterMetadata[] | readonly MetadataParameter[] | undefined,
): readonly ParameterMetadata[] | undefined {
  if (!parameters) {
    return undefined;
  }

  return parameters.map(param => {
    const type = normalizeParamType(param.type);
    const decorators = normalizeDecorators(param.decorators);

    return {
      ...(param.index !== undefined ? { index: param.index } : {}),
      ...(param.name !== undefined ? { name: param.name } : {}),
      ...(type !== undefined ? { type } : {}),
      ...(decorators !== undefined ? { decorators } : {}),
    };
  });
}

function normalizeConstructorParams(
  params: readonly ConstructorParamMetadata[] | readonly MetadataConstructorParam[] | undefined,
): readonly ConstructorParamMetadata[] | undefined {
  if (!params) {
    return undefined;
  }

  return params.map(param => {
    const type = normalizeParamType(param.type);
    const decorators = normalizeDecorators(param.decorators);

    return {
      ...(type !== undefined ? { type } : {}),
      ...(decorators !== undefined ? { decorators } : {}),
    };
  });
}

function normalizeParamType(type: MetadataTypeValue | ParamTypeReference | undefined): ParamTypeReference | undefined {
  if (type === undefined) {
    return undefined;
  }

  return isParamTypeReference(type) ? type : undefined;
}

function isParamTypeReference(value: MetadataTypeValue | ParamTypeReference): value is ParamTypeReference {
  if (typeof value === 'string' || typeof value === 'symbol') {
    return true;
  }

  if (typeof value !== 'function') {
    return false;
  }

  if (value === Number || value === String || value === Boolean) {
    return false;
  }

  return value.prototype !== undefined;
}

function normalizeDecoratorArguments(
  args: readonly DecoratorArgument[] | readonly MetadataArgument[] | undefined,
): readonly DecoratorArgument[] | undefined {
  if (!args) {
    return undefined;
  }

  const normalized: DecoratorArgument[] = [];

  for (const arg of args) {
    normalized.push(arg);
  }

  return normalized;
}

function createRequest(params: CreateRequestParams): BunnerRequest {
  const { method, url, headers, body, query } = params;

  if (body !== undefined && query !== undefined) {
    const init: BunnerRequestInit = {
      httpMethod: method,
      url,
      headers: headers ?? {},
      params: {},
      ip: '127.0.0.1',
      ips: ['127.0.0.1'],
      isTrustedProxy: false,
      body,
      query,
    };

    return new BunnerRequest(init);
  }

  if (body !== undefined) {
    const init: BunnerRequestInit = {
      httpMethod: method,
      url,
      headers: headers ?? {},
      params: {},
      ip: '127.0.0.1',
      ips: ['127.0.0.1'],
      isTrustedProxy: false,
      body,
    };

    return new BunnerRequest(init);
  }

  if (query !== undefined) {
    const init: BunnerRequestInit = {
      httpMethod: method,
      url,
      headers: headers ?? {},
      params: {},
      ip: '127.0.0.1',
      ips: ['127.0.0.1'],
      isTrustedProxy: false,
      query,
    };

    return new BunnerRequest(init);
  }

  const init: BunnerRequestInit = {
    httpMethod: method,
    url,
    headers: headers ?? {},
    params: {},
    ip: '127.0.0.1',
    ips: ['127.0.0.1'],
    isTrustedProxy: false,
  };

  return new BunnerRequest(init);
}

function createResponse(req: BunnerRequest): BunnerResponse {
  return new BunnerResponse(req, new Headers());
}

async function handleRequest(params: HandleRequestParams): Promise<HandleRequestResult> {
  const { harness, method, path, url, headers, body, query } = params;
  const requestParams: CreateRequestParams = { method, url };

  if (headers !== undefined) {
    requestParams.headers = headers;
  }

  if (body !== undefined) {
    requestParams.body = body;
  }

  if (query !== undefined) {
    requestParams.query = query;
  }

  const req = createRequest(requestParams);
  const res = createResponse(req);
  const workerResponse = await harness.requestHandler.handle(req, res, method, path);

  return { workerResponse, req, res };
}

function withGlobalMiddlewares(params: GlobalMiddlewaresParams): ReadonlyArray<TestProvider> {
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

  if (params.systemErrorHandler !== undefined) {
    providers.push({ token: HTTP_SYSTEM_ERROR_HANDLER, value: params.systemErrorHandler });
  }

  return providers;
}

export { createHttpTestHarness, createRequest, createResponse, handleRequest, withGlobalMiddlewares };
