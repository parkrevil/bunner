import type { Server } from 'bun';

import {
  BunnerErrorFilter,
  type BunnerArray,
  type BunnerContainer,
  type BunnerRecord,
  type BunnerValue,
  type ErrorFilterToken,
  type ProviderToken,
} from '@bunner/common';
import { Logger, type LogMetadataValue } from '@bunner/logger';
import { StatusCodes } from 'http-status-codes';

import type {
  BunnerHttpServerBootOptions,
  BunnerHttpServerOptions,
  HttpMiddlewareRegistry,
  HttpWorkerResponse,
  MiddlewareRegistrationInput,
} from './interfaces';
import type {
  AdaptiveRequest,
  ClassMetadata,
  HttpMiddlewareConstructor,
  HttpMiddlewareInstance,
  HttpMiddlewareRegistration,
  HttpMiddlewareToken,
  MetadataRegistryKey,
  RequestBodyValue,
  RequestQueryMap,
} from './types';

import { BunnerHttpContext, BunnerHttpContextAdapter } from './adapter';
import { BunnerRequest } from './bunner-request';
import { BunnerResponse } from './bunner-response';
import { HTTP_ERROR_FILTER } from './constants';
import { HttpMethod } from './enums';
import { HttpMiddlewareLifecycle } from './interfaces';
import { RequestHandler } from './request-handler';
import { RouteHandler } from './route-handler';
import { getIps } from './utils';

const isHttpMethod = (value: string): value is HttpMethod => {
  const methods: string[] = Object.values(HttpMethod);

  return methods.includes(value);
};

const normalizeHttpMethod = (value: string): HttpMethod => {
  const normalized = value.toUpperCase();

  return isHttpMethod(normalized) ? normalized : HttpMethod.Get;
};

export class BunnerHttpServer {
  private container: BunnerContainer;
  private routeHandler: RouteHandler;
  private requestHandler: RequestHandler;
  private logger = new Logger(BunnerHttpServer.name);

  private options: BunnerHttpServerOptions;
  private server: Server<BunnerValue>;

  private middlewares: Partial<Record<string, HttpMiddlewareInstance[]>> = {};

  async boot(container: BunnerContainer, options: BunnerHttpServerBootOptions): Promise<void> {
    this.container = container;
    this.options = options.options ?? options; // Handle nested options

    if (this.options.middlewares) {
      this.prepareMiddlewares(this.options.middlewares);
    }

    this.logger.info('🚀 BunnerHttpServer booting...');

    if (Array.isArray(this.options.errorFilters) && this.options.errorFilters.length > 0) {
      const tokens: readonly ErrorFilterToken[] = this.options.errorFilters;

      this.container.set(HTTP_ERROR_FILTER, (c: BunnerContainer) => {
        const resolved: BunnerValue[] = tokens.map(token => c.get(token));

        return resolved.filter((value): value is BunnerErrorFilter => this.isErrorFilter(value));
      });
    }

    const metadataRegistry = options.metadata ?? new Map<MetadataRegistryKey, ClassMetadata>();
    const scopedKeysMap: Map<ProviderToken, string> = options.scopedKeys ?? new Map<ProviderToken, string>();

    this.routeHandler = new RouteHandler(this.container, metadataRegistry, scopedKeysMap);

    this.routeHandler.register();

    if (Array.isArray(options.internalRoutes) && options.internalRoutes.length > 0) {
      this.routeHandler.registerInternalRoutes(options.internalRoutes);
    }

    this.requestHandler = new RequestHandler(this.container, this.routeHandler, metadataRegistry);

    const serveOptions: Parameters<typeof Bun.serve>[0] = {
      fetch: this.fetch.bind(this),
      reusePort: this.options.reusePort ?? true,
    };

    if (this.options.port !== undefined) {
      serveOptions.port = this.options.port;
    }

    if (this.options.bodyLimit !== undefined) {
      serveOptions.maxRequestBodySize = this.options.bodyLimit;
    }

    this.server = Bun.serve<BunnerValue>(serveOptions);

    this.logger.info(`✨ Server listening on port ${this.options.port}`);

    await Promise.resolve();
  }

  async fetch(req: Request): Promise<Response> {
    const adaptiveReq: AdaptiveRequest = {
      httpMethod: normalizeHttpMethod(req.method),
      url: req.url,
      headers: req.headers.toJSON(),
      queryParams: {},
      params: {},
      ip: '',
      ips: [],
      isTrustedProxy: this.options.trustProxy ?? false,
    };
    const bunnerReq = new BunnerRequest(adaptiveReq);
    const bunnerRes = new BunnerResponse(bunnerReq, new Headers());

    try {
      const adapter = new BunnerHttpContextAdapter(bunnerReq, bunnerRes);
      const context = new BunnerHttpContext(adapter);
      // 1. beforeRequest
      const continueBeforeRequest = await this.runMiddlewares(HttpMiddlewareLifecycle.BeforeRequest, context);

      if (!continueBeforeRequest) {
        return this.toResponse(bunnerRes.end());
      }

      const httpMethod = normalizeHttpMethod(req.method);
      let body: RequestBodyValue | undefined = undefined;
      const contentType = req.headers.get('content-type') ?? '';

      if (
        httpMethod !== HttpMethod.Get &&
        httpMethod !== HttpMethod.Delete &&
        httpMethod !== HttpMethod.Head &&
        httpMethod !== HttpMethod.Options
      ) {
        if (contentType.includes('application/json')) {
          try {
            const parsed = await req.json();

            body = this.isJsonValue(parsed) ? parsed : {};
          } catch {
            body = {};
          }
        } else {
          body = await req.text();
        }
      }

      const { ip, ips } = getIps(req, this.server, this.options.trustProxy);
      const urlObj = new URL(req.url, 'http://localhost');
      const path = urlObj.pathname;
      // Update adaptiveReq with parsed data
      const queryParams: RequestQueryMap = Object.fromEntries(urlObj.searchParams.entries());

      Object.assign(adaptiveReq, {
        body,
        queryParams,
        ip,
        ips,
        query: queryParams,
      });

      bunnerReq.body = body ?? null;
      bunnerReq.query = queryParams;

      // 2. afterRequest (Post-Parsing)
      const continueAfterRequest = await this.runMiddlewares(HttpMiddlewareLifecycle.AfterRequest, context);

      if (!continueAfterRequest) {
        return this.toResponse(bunnerRes.end());
      }

      // 3. beforeHandler (Pre-Routing/Handling)
      const continueBeforeHandler = await this.runMiddlewares(HttpMiddlewareLifecycle.BeforeHandler, context);

      if (!continueBeforeHandler) {
        return this.toResponse(bunnerRes.end());
      }

      // Handle Request
      const workerRes = await this.requestHandler.handle(bunnerReq, bunnerRes, httpMethod, path, context);

      // 4. beforeResponse
      try {
        const continueBeforeResponse = await this.runMiddlewares(HttpMiddlewareLifecycle.BeforeResponse, context);

        if (!continueBeforeResponse) {
          return this.toResponse(bunnerRes.end());
        }
      } catch (error) {
        const logValue: LogMetadataValue =
          error instanceof Error
            ? error
            : typeof error === 'string' || typeof error === 'number' || typeof error === 'boolean'
              ? error
              : typeof error === 'object'
                ? (JSON.stringify(error) ?? 'Unknown error')
                : 'Unknown error';

        this.logger.error('Error in beforeResponse', logValue);

        if (bunnerRes.getStatus() === 0) {
          bunnerRes.setStatus(StatusCodes.INTERNAL_SERVER_ERROR);
        }

        return this.toResponse(bunnerRes.end());
      }

      const response = this.toResponse(workerRes);

      // 5. afterResponse (Note: Response is immutable in standard Request/Response,
      // but we can execute logic here. However, we've already created the Response object.)
      try {
        await this.runMiddlewares(HttpMiddlewareLifecycle.AfterResponse, context);
      } catch (error) {
        const logValue: LogMetadataValue =
          error instanceof Error
            ? error
            : typeof error === 'string' || typeof error === 'number' || typeof error === 'boolean'
              ? error
              : typeof error === 'object'
                ? (JSON.stringify(error) ?? 'Unknown error')
                : 'Unknown error';

        this.logger.error('Error in afterResponse', logValue);
      }

      return response;
    } catch (error) {
      const logValue: LogMetadataValue =
        error instanceof Error
          ? error
          : typeof error === 'string' || typeof error === 'number' || typeof error === 'boolean'
            ? error
            : typeof error === 'object'
              ? (JSON.stringify(error) ?? 'Unknown error')
              : 'Unknown error';

      this.logger.error('Fetch Error', logValue);

      return new Response('Internal server error', {
        status: StatusCodes.INTERNAL_SERVER_ERROR,
      });
    }
  }

  private async runMiddlewares(lifecycle: string, ctx: BunnerHttpContext): Promise<boolean> {
    const list = this.middlewares[lifecycle] ?? [];

    for (const middleware of list) {
      const result = await middleware.handle(ctx);

      if (result === false) {
        return false;
      }
    }

    return true;
  }

  private prepareMiddlewares(registry: HttpMiddlewareRegistry): void {
    const resolved: Partial<Record<string, HttpMiddlewareInstance[]>> = {};
    const lifecycles: string[] = Object.values(HttpMiddlewareLifecycle);

    lifecycles.forEach(lifecycle => {
      const entries = registry[lifecycle];

      if (!entries) {
        return;
      }

      const instances: HttpMiddlewareInstance[] = [];

      entries.forEach((entry, index) => {
        const normalized = this.normalizeRegistration(entry);
        const optionToken = Symbol.for(`middleware:${this.getTokenName(normalized.token)}:options:${index}`);
        const instanceToken = Symbol.for(`middleware:${this.getTokenName(normalized.token)}:instance:${index}`);

        if (normalized.options !== undefined) {
          if (!this.container.has(optionToken)) {
            this.container.set(optionToken, () => normalized.options);
          }
        }

        if (!this.container.has(instanceToken)) {
          this.container.set(instanceToken, (c: BunnerContainer) => {
            if (c.has(normalized.token)) {
              return c.get(normalized.token);
            }

            const ctor = normalized.token;

            if (!this.isMiddlewareConstructor(ctor)) {
              throw new Error('Middleware token must be a class constructor');
            }

            try {
              if (normalized.options !== undefined) {
                return new ctor(normalized.options);
              }

              return new ctor();
            } catch (_e) {
              return new ctor();
            }
          });
        }

        const instance = this.container.get(instanceToken);

        if (!this.isMiddlewareInstance(instance)) {
          throw new Error('Middleware instance is invalid');
        }

        instances.push(instance);
      });

      resolved[lifecycle] = instances;
    });

    this.middlewares = resolved;
  }

  private normalizeRegistration(entry: MiddlewareRegistrationInput): HttpMiddlewareRegistration {
    if (this.isMiddlewareToken(entry)) {
      return { token: entry };
    }

    return entry;
  }

  private isMiddlewareInstance(value: BunnerValue | HttpMiddlewareInstance | null | undefined): value is HttpMiddlewareInstance {
    if (!this.isBunnerRecord(value)) {
      return false;
    }

    return typeof value.handle === 'function';
  }

  private isErrorFilter(value: BunnerValue | BunnerErrorFilter | null | undefined): value is BunnerErrorFilter {
    if (!this.isBunnerRecord(value)) {
      return false;
    }

    return 'catch' in value;
  }

  private isJsonValue(value: BunnerValue): value is RequestBodyValue {
    if (value === null) {
      return true;
    }

    const valueType = typeof value;

    if (valueType === 'string' || valueType === 'number' || valueType === 'boolean') {
      return true;
    }

    if (this.isBunnerArray(value)) {
      for (const entry of value) {
        if (!this.isJsonValue(entry)) {
          return false;
        }
      }

      return true;
    }

    if (this.isBunnerRecord(value)) {
      for (const entry of Object.values(value)) {
        if (!this.isJsonValue(entry)) {
          return false;
        }
      }

      return true;
    }

    return false;
  }

  private getTokenName(token: HttpMiddlewareToken): string {
    if (typeof token === 'symbol') {
      return token.description ?? 'symbol';
    }

    if (this.isMiddlewareConstructor(token)) {
      return token.name ?? 'anonymous';
    }

    return 'anonymous';
  }

  private isMiddlewareToken(value: MiddlewareRegistrationInput): value is HttpMiddlewareToken {
    return typeof value === 'symbol' || this.isMiddlewareConstructor(value);
  }

  private isMiddlewareConstructor(value: HttpMiddlewareToken | MiddlewareRegistrationInput): value is HttpMiddlewareConstructor {
    return typeof value === 'function';
  }

  private isBunnerArray(value: BunnerValue): value is BunnerArray {
    return Array.isArray(value);
  }

  private isBunnerRecord(value: BunnerValue): value is BunnerRecord {
    return typeof value === 'object' && value !== null;
  }

  private toResponse(workerRes: HttpWorkerResponse): Response {
    const init: ResponseInit = workerRes.init ?? {};
    const status = init.status;

    if (status === 0 || status === undefined) {
      const { status: _status, statusText: _statusText, ...rest } = init;

      return new Response(workerRes.body, rest);
    }

    if (typeof status === 'number' && status !== 101 && (status < 200 || status > 599)) {
      return new Response(workerRes.body, {
        ...init,
        status: StatusCodes.INTERNAL_SERVER_ERROR,
      });
    }

    return new Response(workerRes.body, init);
  }
}
