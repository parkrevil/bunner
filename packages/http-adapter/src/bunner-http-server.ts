import { type BunnerContainer, type BunnerMiddleware, type MiddlewareRegistration } from '@bunner/common';
import { Logger } from '@bunner/logger';
import type { Server } from 'bun';
import { StatusCodes } from 'http-status-codes';

import { BunnerHttpContext, BunnerHttpContextAdapter } from './adapter';
import { BunnerRequest } from './bunner-request';
import { BunnerResponse } from './bunner-response';
import { HTTP_ERROR_FILTER } from './constants';
import { HttpMethod } from './enums';
import type {
  BunnerHttpServerOptions,
  HttpMiddlewareRegistry,
  HttpWorkerResponse,
  MiddlewareRegistrationInput,
} from './interfaces';
import { HttpMiddlewareLifecycle } from './interfaces';
import { RequestHandler } from './request-handler';
import { RouteHandler } from './route-handler';
import { getIps } from './utils';

export class BunnerHttpServer {
  private container: BunnerContainer;
  private routeHandler: RouteHandler;
  private requestHandler: RequestHandler;
  private logger = new Logger(BunnerHttpServer.name);

  private options: BunnerHttpServerOptions;
  private server: Server<any>;

  private middlewares: Partial<Record<HttpMiddlewareLifecycle, BunnerMiddleware[]>> = {};

  async boot(container: BunnerContainer, options: any): Promise<void> {
    this.container = container;
    this.options = options.options || options; // Handle nested options

    if ((this.options as any).middlewares) {
      this.prepareMiddlewares((this.options as any).middlewares as HttpMiddlewareRegistry);
    }

    this.logger.info('🚀 BunnerHttpServer booting...');

    if (Array.isArray((this.options as any).errorFilters) && (this.options as any).errorFilters.length > 0) {
      const tokens = (this.options as any).errorFilters as readonly any[];

      this.container.set(HTTP_ERROR_FILTER, (c: BunnerContainer) => {
        return tokens.map(token => c.get(token));
      });
    }

    const metadataRegistry = options.metadata || new Map();
    const scopedKeysMap = options.scopedKeys || new Map();

    this.routeHandler = new RouteHandler(this.container, metadataRegistry, scopedKeysMap);

    this.routeHandler.register();

    if (Array.isArray(options.internalRoutes) && options.internalRoutes.length > 0) {
      this.routeHandler.registerInternalRoutes(options.internalRoutes);
    }

    this.requestHandler = new RequestHandler(this.container, this.routeHandler, metadataRegistry);

    const serveOptions = {
      port: this.options.port,
      reusePort: (this.options as any).reusePort ?? true,
      maxRequestBodySize: this.options.bodyLimit,
      fetch: this.fetch.bind(this),
    };

    this.server = Bun.serve(serveOptions);

    this.logger.info(`✨ Server listening on port ${this.options.port}`);

    await Promise.resolve();
  }

  async fetch(req: Request): Promise<Response> {
    const adaptiveReq = {
      httpMethod: req.method.toUpperCase() as HttpMethod,
      url: req.url,
      headers: req.headers.toJSON(),
      body: undefined as any,
      queryParams: {},
      params: {},
      ip: '',
      ips: [] as string[],
      isTrustedProxy: this.options.trustProxy || false,
    };
    const bunnerReq = new BunnerRequest(adaptiveReq);
    const bunnerRes = new BunnerResponse(bunnerReq, { headers: new Headers(), status: 0 } as any);

    try {
      const adapter = new BunnerHttpContextAdapter(bunnerReq, bunnerRes);
      const context = new BunnerHttpContext(adapter);
      // 1. beforeRequest
      const continueBeforeRequest = await this.runMiddlewares(HttpMiddlewareLifecycle.BeforeRequest, context);

      if (!continueBeforeRequest) {
        return this.toResponse(bunnerRes.end());
      }

      const httpMethod = req.method.toUpperCase() as HttpMethod;
      let body: any = undefined;
      const contentType = req.headers.get('content-type') || '';

      if (
        httpMethod !== HttpMethod.Get &&
        httpMethod !== HttpMethod.Delete &&
        httpMethod !== HttpMethod.Head &&
        httpMethod !== HttpMethod.Options
      ) {
        if (contentType.includes('application/json')) {
          try {
            body = await req.json();
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
      Object.assign(adaptiveReq, {
        body,
        queryParams: Object.fromEntries(urlObj.searchParams.entries()),
        ip,
        ips,
      });

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
      } catch (e) {
        this.logger.error('Error in beforeResponse', e);

        if (bunnerRes.getStatus() === 0) {
          bunnerRes.setStatus(StatusCodes.INTERNAL_SERVER_ERROR);
        }
      }

      const response = this.toResponse(workerRes);

      // 5. afterResponse (Note: Response is immutable in standard Request/Response,
      // but we can execute logic here. However, we've already created the Response object.)
      try {
        await this.runMiddlewares(HttpMiddlewareLifecycle.AfterResponse, context);
      } catch (e) {
        this.logger.error('Error in afterResponse', e);
      }

      return response;
    } catch (e: any) {
      this.logger.error('Fetch Error', e);

      return new Response('Internal server error', {
        status: StatusCodes.INTERNAL_SERVER_ERROR,
      });
    }
  }

  private async runMiddlewares(lifecycle: HttpMiddlewareLifecycle, ctx: BunnerHttpContext): Promise<boolean> {
    const list = this.middlewares[lifecycle] || [];

    for (const middleware of list) {
      const result = await middleware.handle(ctx);

      if (result === false) {
        return false;
      }
    }

    return true;
  }

  private prepareMiddlewares(registry: HttpMiddlewareRegistry): void {
    const resolved: Partial<Record<HttpMiddlewareLifecycle, BunnerMiddleware[]>> = {};

    (Object.values(HttpMiddlewareLifecycle) as HttpMiddlewareLifecycle[]).forEach(lifecycle => {
      const entries = registry[lifecycle];

      if (!entries) {
        return;
      }

      const instances: BunnerMiddleware[] = [];

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

            const ctor = normalized.token as any;

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

        const instance = this.container.get<BunnerMiddleware>(instanceToken);

        instances.push(instance);
      });

      resolved[lifecycle] = instances;
    });

    this.middlewares = resolved;
  }

  private normalizeRegistration(entry: MiddlewareRegistrationInput): MiddlewareRegistration {
    if (typeof entry === 'function' || typeof entry === 'symbol') {
      return { token: entry };
    }

    return entry;
  }

  private getTokenName(token: MiddlewareRegistration['token']): string {
    if (typeof token === 'symbol') {
      return token.description || 'symbol';
    }

    return (token as any).name || 'anonymous';
  }

  private toResponse(workerRes: HttpWorkerResponse): Response {
    return new Response(workerRes.body, workerRes.init);
  }
}
