import type { BunnerContainer, Context, ErrorHandler, BunnerMiddleware } from '@bunner/common';
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
  private globalBeforeRequest: BunnerMiddleware[] = [];
  private globalBeforeResponse: BunnerMiddleware[] = [];
  private globalAfterResponse: BunnerMiddleware[] = [];
  private globalErrorHandlers: ErrorHandler[] = [];

  constructor(
    private readonly container: BunnerContainer,
    private readonly routeHandler: RouteHandler,
    private readonly metadataRegistry: Map<any, any>,
  ) {
    this.loadMiddlewares();
  }

  public async handle(
    req: BunnerRequest,
    res: BunnerResponse,
    method: HttpMethod,
    path: string,
    context?: BunnerHttpContext,
  ): Promise<HttpWorkerResponse> {
    const ctx = context ?? new BunnerHttpContext(new BunnerHttpContextAdapter(req, res));
    let matchResult: any = undefined;

    try {
      // 1. Global Before Request
      const shouldContinue = await this.runMiddlewares(this.globalBeforeRequest, ctx);

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
        const scopedContinue = await this.runMiddlewares(scopedMiddlewares, ctx);

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

      const handled = await this.runErrorHandlers(e, ctx, matchResult?.entry);

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
      await this.runMiddlewares(this.globalBeforeResponse, ctx);
    } catch (e) {
      this.logger.error('Error in beforeResponse', e);
    }

    // 6. After Response
    try {
      await this.runMiddlewares(this.globalAfterResponse, ctx);
    } catch (e) {
      this.logger.error('Error in afterResponse', e);
    }

    if (res.isSent()) {
      return res.getWorkerResponse();
    }

    return res.end();
  }

  private async runMiddlewares(middlewares: BunnerMiddleware[], ctx: Context): Promise<boolean> {
    for (const mw of middlewares) {
      const result = await mw.handle(ctx);

      if (result === false) {
        return false;
      }
    }

    return true;
  }

  private async runErrorHandlers(error: unknown, ctx: Context, entry?: RouteHandlerEntry): Promise<boolean> {
    const handlers: ErrorHandler[] = [...(entry?.errorHandlers ?? []), ...this.globalErrorHandlers];

    for (const handler of handlers) {
      const meta = this.metadataRegistry?.get((handler as any).constructor);
      const catchDec = meta?.decorators.find((d: any) => d.name === 'Catch');
      const shouldCatch =
        !catchDec ||
        catchDec.arguments.length === 0 ||
        catchDec.arguments.some((exceptionType: any) => error instanceof exceptionType);

      if (!shouldCatch) {
        continue;
      }

      const fn = typeof handler === 'function' ? handler : (handler as any).catch;

      if (typeof fn !== 'function') {
        continue;
      }

      const ctxValue = ctx as unknown as Record<string, unknown>;

      if (fn.length >= 2) {
        await fn.call(handler, error, ctxValue['request'], ctxValue['response'], ctxValue['next']);
      } else {
        await fn.call(handler, error, ctx);
      }

      return true;
    }

    return false;
  }

  private loadMiddlewares() {
    this.globalBeforeRequest = this.resolveTokens<BunnerMiddleware>(HTTP_BEFORE_REQUEST);
    this.globalBeforeResponse = this.resolveTokens<BunnerMiddleware>(HTTP_BEFORE_RESPONSE);
    this.globalAfterResponse = this.resolveTokens<BunnerMiddleware>(HTTP_AFTER_RESPONSE);
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
