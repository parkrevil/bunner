import type { BunnerContainer, Context, BunnerErrorFilter, BunnerMiddleware } from '@bunner/common';
import { Logger } from '@bunner/logger';
import { StatusCodes } from 'http-status-codes';

import { BunnerHttpContext, BunnerHttpContextAdapter } from './adapter';
import { BunnerRequest } from './bunner-request';
import { BunnerResponse } from './bunner-response';
import {
  HTTP_AFTER_RESPONSE,
  HTTP_BEFORE_REQUEST,
  HTTP_BEFORE_RESPONSE,
  HTTP_ERROR_FILTER,
  HTTP_SYSTEM_ERROR_HANDLER,
} from './constants';
import { HttpMethod } from './enums';
import type { HttpWorkerResponse, RouteHandlerEntry, SystemErrorHandler } from './interfaces';
import type { RouteHandler } from './route-handler';

export class RequestHandler {
  private readonly logger = new Logger(RequestHandler.name);
  private globalBeforeRequest: BunnerMiddleware[] = [];
  private globalBeforeResponse: BunnerMiddleware[] = [];
  private globalAfterResponse: BunnerMiddleware[] = [];
  private globalErrorFilters: BunnerErrorFilter[] = [];
  private systemErrorHandler: SystemErrorHandler | undefined;

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
    let systemErrorHandlerCalled = false;
    let processingError: unknown = undefined;
    const applyDefaultErrorHandler = (params: {
      readonly error: unknown;
      readonly stage: string;
      readonly allowBody: boolean;
    }): void => {
      const { error, stage, allowBody } = params;
      const statusWasUnset = res.getStatus() === 0;

      if (statusWasUnset) {
        res.setStatus(StatusCodes.INTERNAL_SERVER_ERROR);
      }

      const bodyWasUnset = res.getBody() === undefined;

      if (allowBody && bodyWasUnset) {
        res.setBody('Internal Server Error');
      }

      if (statusWasUnset || (allowBody && bodyWasUnset)) {
        this.logger.error('DefaultErrorHandler applied', {
          stage,
          statusWasUnset,
          bodyWasUnset: allowBody && bodyWasUnset,
          error,
        });
      }
    };
    const tryRunSystemErrorHandler = async (params: {
      readonly error: unknown;
      readonly stage: string;
      readonly allowBody: boolean;
    }): Promise<void> => {
      const { error, stage, allowBody } = params;

      if (!this.systemErrorHandler) {
        return;
      }

      if (systemErrorHandlerCalled) {
        return;
      }

      systemErrorHandlerCalled = true;

      try {
        await this.systemErrorHandler.handle(error, ctx);
      } catch (handlerError) {
        this.logger.error('SystemErrorHandler failed', {
          stage,
          handlerToken: (this.systemErrorHandler as any)?.constructor?.name,
          originalError: error,
          handlerError,
        });

        applyDefaultErrorHandler({ error, stage: `${stage}:systemErrorHandlerFailed`, allowBody });
      }
    };

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

      processingError = e;

      let currentError: unknown = e;

      try {
        const result = await this.runErrorFilters({
          error: e,
          ctx,
          entry: matchResult?.entry,
        });

        currentError = result.currentError;
      } catch (errorFilterEngineError) {
        this.logger.error('ErrorFilter engine failed', {
          originalError: e,
          errorFilterEngineError,
        });

        currentError = errorFilterEngineError;
      }

      processingError = currentError;

      if (res.getStatus() === 0) {
        await tryRunSystemErrorHandler({ error: currentError, stage: 'afterErrorFilters:statusUnset', allowBody: true });
      }

      applyDefaultErrorHandler({ error: currentError, stage: 'afterErrorFilters:default', allowBody: true });
    }

    // 5. Before Response
    try {
      await this.runMiddlewares(this.globalBeforeResponse, ctx);
    } catch (e) {
      this.logger.error('Error in beforeResponse', e);

      await tryRunSystemErrorHandler({ error: e, stage: 'beforeResponse:error', allowBody: false });
      applyDefaultErrorHandler({ error: e, stage: 'beforeResponse:error', allowBody: false });
    }

    // 6. After Response
    try {
      await this.runMiddlewares(this.globalAfterResponse, ctx);
    } catch (e) {
      this.logger.error('Error in afterResponse', e);
    }

    if (processingError !== undefined) {
      applyDefaultErrorHandler({ error: processingError, stage: 'processingError:finalize', allowBody: true });
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

  private async runErrorFilters(params: {
    readonly error: unknown;
    readonly ctx: Context;
    readonly entry?: RouteHandlerEntry;
  }): Promise<{ readonly originalError: unknown; readonly currentError: unknown }> {
    const { error, ctx, entry } = params;
    const filters: BunnerErrorFilter[] = [...(entry?.errorFilters ?? []), ...this.globalErrorFilters];
    const originalError = error;
    let currentError: unknown = error;

    for (const filter of filters) {
      if (!this.shouldCatch({ error: currentError, filter })) {
        continue;
      }

      try {
        await filter.catch(currentError as any, ctx);
      } catch (nextError) {
        currentError = nextError;
      }
    }

    return { originalError, currentError };
  }

  private shouldCatch(params: { readonly error: unknown; readonly filter: BunnerErrorFilter }): boolean {
    const { error, filter } = params;
    const meta = this.metadataRegistry?.get((filter as any).constructor);
    const catchDec = (meta?.decorators || []).find((d: any) => d.name === 'Catch');

    if (!catchDec) {
      return true;
    }

    const args: unknown[] = catchDec.arguments || [];

    if (args.length === 0) {
      return true;
    }

    for (const arg of args) {
      if (this.matchesCatchArgument({ error, arg })) {
        return true;
      }
    }

    return false;
  }

  private matchesCatchArgument(params: { readonly error: unknown; readonly arg: unknown }): boolean {
    const { error, arg } = params;

    if (arg === String) {
      if (typeof error === 'string') {
        return true;
      }

      if (error instanceof String) {
        return true;
      }

      return false;
    }

    if (arg === Number) {
      if (typeof error === 'number') {
        return true;
      }

      if (error instanceof Number) {
        return true;
      }

      return false;
    }

    if (arg === Boolean) {
      if (typeof error === 'boolean') {
        return true;
      }

      if (error instanceof Boolean) {
        return true;
      }

      return false;
    }

    if (typeof arg === 'string') {
      return error === arg;
    }

    if (typeof arg === 'function') {
      try {
        return error instanceof (arg as any);
      } catch {
        return false;
      }
    }

    return false;
  }

  private loadMiddlewares() {
    this.globalBeforeRequest = this.resolveTokens<BunnerMiddleware>(HTTP_BEFORE_REQUEST);
    this.globalBeforeResponse = this.resolveTokens<BunnerMiddleware>(HTTP_BEFORE_RESPONSE);
    this.globalAfterResponse = this.resolveTokens<BunnerMiddleware>(HTTP_AFTER_RESPONSE);
    this.globalErrorFilters = this.resolveTokens<BunnerErrorFilter>(HTTP_ERROR_FILTER, { strict: true });
    this.systemErrorHandler = this.resolveTokens<SystemErrorHandler>(HTTP_SYSTEM_ERROR_HANDLER, { strict: true })[0];
  }

  private resolveTokens<T>(token: string, options?: { readonly strict?: boolean }): T[] {
    const results: T[] = [];
    const strict = options?.strict === true;

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
      } catch (e) {
        if (strict) {
          throw e;
        }
      }
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
        } catch (e) {
          if (strict) {
            throw e;
          }
        }
      }
    }

    return results;
  }
}
