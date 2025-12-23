import { type BunnerRuntime, type Container, type Middleware, type ErrorHandler, type Context } from '@bunner/core';
import { Logger } from '@bunner/logger';
import type { Server } from 'bun';
import { StatusCodes } from 'http-status-codes';

import { BunnerHttpContextAdapter, BunnerHttpContext } from './adapter';
import { BunnerRequest } from './bunner-request';
import { BunnerResponse } from './bunner-response';
import { HTTP_AFTER_RESPONSE, HTTP_BEFORE_REQUEST, HTTP_BEFORE_RESPONSE, HTTP_ERROR_HANDLER } from './constants';
import { HttpMethod } from './enums';
// removed MethodNotAllowedError
import type { HttpWorkerResponse, RouteHandlerEntry } from './interfaces';
import { RouteHandler } from './route-handler';
import { getIps } from './utils';

export class HttpRuntime implements BunnerRuntime {
  private container: Container;
  private routeHandler: RouteHandler;
  private logger = new Logger(HttpRuntime.name);
  private metadataRegistry: Map<any, any> | undefined;

  private globalBeforeRequest: Middleware[] = [];
  private globalBeforeResponse: Middleware[] = [];
  private globalAfterResponse: Middleware[] = [];
  private globalErrorHandlers: ErrorHandler[] = [];

  private options: any;
  private server: Server<any>;

  async boot(container: Container, options: any) {
    this.container = container;
    this.options = options.options || options; // Handle nested options if necessary

    this.logger.info('🚀 HttpRuntime booting...');

    // Resolve Metadata Registry from Container or Global if available
    this.metadataRegistry = options.metadata || new Map();
    const scopedKeysMap = options.scopedKeys || new Map();

    this.routeHandler = new RouteHandler(this.container, this.metadataRegistry || new Map(), scopedKeysMap);
    this.routeHandler.register();
    this.loadMiddlewares();

    const serveOptions = {
      port: this.options.port,
      reusePort: true, // Always reuse port in Cluster/Runtime mode?
      // If Single mode, reusePort might not be needed but doesn't hurt.
      maxRequestBodySize: this.options.bodyLimit,
      fetch: this.fetch.bind(this),
    };

    this.server = Bun.serve(serveOptions);
    this.logger.info(`✨ Server listening on port ${this.options.port}`);
    await Promise.resolve();
  }

  async fetch(req: Request): Promise<Response> {
    try {
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
            body = {}; // invalid json
          }
        } else {
          body = await req.text();
        }
      }

      const { ip, ips } = getIps(req, this.server, this.options.trustProxy);

      const workerRes = await this.processRequest({
        httpMethod,
        url: req.url,
        headers: req.headers.toJSON(),
        body,
        request: {
          ip,
          ips,
          isTrustedProxy: this.options.trustProxy,
        },
      });

      return new Response(workerRes.body, workerRes.init);
    } catch (e: any) {
      this.logger.error('Fetch Error', e);
      return new Response('Internal server error', {
        status: StatusCodes.INTERNAL_SERVER_ERROR,
      });
    }
  }

  private async processRequest(params: any): Promise<HttpWorkerResponse> {
    const { httpMethod, url, headers, body, request: reqContext } = params;

    const urlObj = new URL(url, 'http://localhost');
    const path = urlObj.pathname;
    const methodStr = httpMethod;

    const adaptiveReq = {
      httpMethod,
      url,
      headers,
      body,
      queryParams: Object.fromEntries(urlObj.searchParams.entries()),
      params: {},
      ...reqContext,
    };

    const req = new BunnerRequest(adaptiveReq);
    const res = new BunnerResponse(req, { headers: new Headers(), status: 0 } as any);
    const adapter = new BunnerHttpContextAdapter(req, res);
    const context = new BunnerHttpContext(adapter);

    let matchResult: any = undefined;

    try {
      // 1. Global Before Request
      const shouldContinue = await this.runMiddlewares(this.globalBeforeRequest, context);

      if (shouldContinue) {
        // 2. Routing
        matchResult = this.routeHandler.match(methodStr, path);

        if (!matchResult) {
          throw new Error(`Route not found: ${methodStr} ${path}`);
        }

        // @ts-expect-error: params is dynamically assigned from router
        req.params = matchResult.params;

        // 3. Scoped Middlewares (Before Handler) - Pre-calculated
        const scopedMiddlewares = matchResult.entry.middlewares;
        const scopedContinue = await this.runMiddlewares(scopedMiddlewares, context);

        if (scopedContinue) {
          this.logger.debug(`Matched Route: ${methodStr}:${path}`);

          // 4. Handler
          const routeEntry = matchResult.entry;
          const handlerArgs = await routeEntry.paramFactory(req, res);

          const result = await routeEntry.handler(...handlerArgs);

          if (result instanceof Response) {
            return {
              body: await result.text(),
              init: { status: result.status, headers: result.headers.toJSON() },
            };
          }
          if (result !== undefined) {
            res.setBody(result);
          }
        }
      }
    } catch (e: any) {
      this.logger.error(`Error during processRequest: ${e.message}`, e.stack);
      const handled = await this.runErrorHandlers(e, context, matchResult?.entry);
      if (!handled) {
        this.logger.error('Unhandled Error', e);
        return {
          body: 'Internal Server Error',
          init: { status: StatusCodes.INTERNAL_SERVER_ERROR },
        };
      }
    }

    // 5. Before Response
    try {
      await this.runMiddlewares(this.globalBeforeResponse, context);
    } catch (e) {
      this.logger.error('Error in beforeResponse', e);
    }

    // 6. After Response
    try {
      await this.runMiddlewares(this.globalAfterResponse, context);
    } catch (e) {
      this.logger.error('Error in afterResponse', e);
    }

    if (res.isSent()) {
      return res.getWorkerResponse();
    }
    return res.end();
  }

  private async runMiddlewares(middlewares: Middleware[], ctx: Context): Promise<boolean> {
    for (const mw of middlewares) {
      const result = await mw.handle(ctx);
      if (result === false) {
        return false;
      }
    }
    return true;
  }

  private async runErrorHandlers(error: any, ctx: Context, entry?: RouteHandlerEntry): Promise<boolean> {
    // 1. Scoped Handlers (Pre-calculated)
    let handlers: ErrorHandler[] = entry ? entry.errorHandlers : [];

    // 2. Global Handlers
    handlers = [...handlers, ...this.globalErrorHandlers];

    for (const handler of handlers) {
      // Still need metadata to check @Catch
      // Optimization possibility: Store catch types on handler instance during load
      const meta = this.metadataRegistry?.get(handler.constructor);
      const catchDec = meta?.decorators.find((d: any) => d.name === 'Catch');

      let shouldCatch = false;
      if (!catchDec || catchDec.arguments.length === 0) {
        shouldCatch = true; // Catch all
      } else {
        shouldCatch = catchDec.arguments.some((exceptionType: any) => error instanceof exceptionType);
      }

      if (shouldCatch) {
        await handler.catch(error, ctx);
        return true;
      }
    }

    return false;
  }

  private loadMiddlewares() {
    this.globalBeforeRequest = this.resolveTokens<Middleware>(HTTP_BEFORE_REQUEST);
    this.globalBeforeResponse = this.resolveTokens<Middleware>(HTTP_BEFORE_RESPONSE);
    this.globalAfterResponse = this.resolveTokens<Middleware>(HTTP_AFTER_RESPONSE);
    this.globalErrorHandlers = this.resolveTokens<ErrorHandler>(HTTP_ERROR_HANDLER);
  }

  private resolveTokens<T>(token: string): T[] {
    const results: T[] = [];

    // 1. Direct match (Global/Legacy)
    if (this.container.has(token)) {
      try {
        const result = this.container.get(token);
        if (result) {
          if (Array.isArray(result)) {
            results.push(...result);
          } else {
            results.push(result);
          }
        }
      } catch {}
    }

    // 2. Namespaced match (Module::Token)
    for (const key of this.container.keys()) {
      if (typeof key === 'string' && key.endsWith(`::${token}`)) {
        try {
          const result = this.container.get(key);
          if (result) {
            if (Array.isArray(result)) {
              results.push(...result);
            } else {
              results.push(result);
            }
          }
        } catch {}
      }
    }

    return results;
  }
}
