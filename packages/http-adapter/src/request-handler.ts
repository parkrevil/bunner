import type { Container, Context, ErrorHandler, Middleware } from '@bunner/core';
import { Logger } from '@bunner/logger';
import { StatusCodes } from 'http-status-codes';

import { BunnerHttpContext, BunnerHttpContextAdapter } from './adapter';
import { BunnerRequest } from './bunner-request';
import { BunnerResponse } from './bunner-response';
import { HTTP_AFTER_RESPONSE, HTTP_BEFORE_REQUEST, HTTP_BEFORE_RESPONSE, HTTP_ERROR_HANDLER } from './constants';
import { HttpMethod } from './enums';
import type { HttpWorkerResponse, RouteHandlerEntry } from './interfaces';
import type { RouteHandler } from './route-handler';

export class RequestHandler {
  private readonly logger = new Logger(RequestHandler.name);
  private globalBeforeRequest: Middleware[] = [];
  private globalBeforeResponse: Middleware[] = [];
  private globalAfterResponse: Middleware[] = [];
  private globalErrorHandlers: ErrorHandler[] = [];

  constructor(
    private readonly container: Container,
    private readonly routeHandler: RouteHandler,
    private readonly metadataRegistry: Map<any, any>,
  ) {
    this.loadMiddlewares();
  }

  public async handle(req: BunnerRequest, res: BunnerResponse, method: HttpMethod, path: string): Promise<HttpWorkerResponse> {
    const adapter = new BunnerHttpContextAdapter(req, res);
    const context = new BunnerHttpContext(adapter);

    let matchResult: any = undefined;

    try {
      // 1. Global Before Request
      const shouldContinue = await this.runMiddlewares(this.globalBeforeRequest, context);

      if (shouldContinue) {
        // 2. Routing
        matchResult = this.routeHandler.match(method, path);

        if (!matchResult) {
          throw new Error(`Route not found: ${method} ${path}`);
        }

        // @ts-expect-error: params is dynamically assigned from router
        req.params = matchResult.params;

        // 3. Scoped Middlewares (Before Handler) - Pre-calculated
        const scopedMiddlewares = matchResult.entry.middlewares;
        const scopedContinue = await this.runMiddlewares(scopedMiddlewares, context);

        if (scopedContinue) {
          this.logger.debug(`Matched Route: ${method}:${path}`);

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
      this.logger.error(`Error during processing: ${e.message}`, e.stack);
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
