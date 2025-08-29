import type { Server } from 'bun';
import { type BunnerWebServerStartOptions, type HttpMethodValue } from '.';
import { BunnerApplication } from '../bunner-application';
import { RequestContext } from '../providers/injector';
import type { MiddlewareContext, PhaseMiddlewareMap } from './providers/middleware';
import { type GlobalMiddlewareOptions, type RouteMiddlewareOptions, MiddlewareProvider } from './providers/middleware';
import { RouterProvider } from './providers/router';
import { BunnerRequest } from './request';
import { BunnerResponse } from './response';

export class BunnerWebApplication extends BunnerApplication {
  private readonly routerProvider: RouterProvider;
  private readonly middlewareProvider: MiddlewareProvider;
  private server: Server;

  constructor() {
    super();

    this.middlewareProvider = new MiddlewareProvider();
    this.routerProvider = new RouterProvider(this.container, this.middlewareProvider);
  }

  /**
   * Start the web application
   * @param options - The options for the web application
   * @returns A promise that resolves to true if the application started successfully
   */
  async start(options: BunnerWebServerStartOptions) {
    this.routerProvider.register();

    this.server = Bun.serve({
      fetch: this.handleRequest.bind(this),
      ...options,
    });
  }

  /**
   * Stop the server
   * @param force - Whether to force the server to close
   * @returns A promise that resolves to true if the application stopped successfully
   */
  async stop(force = false) {
    if (!this.server) {
      return;
    }

    await this.server.stop(force);
  }

  /**
   * Handle a request
   * @param rawReq - The raw request
   * @param server - The server
   * @returns The response
   */
  private async handleRequest(rawReq: Request, server: Server) {
    const route = this.routerProvider.find(rawReq.method as HttpMethodValue, rawReq.url);

    if (!route) {
      return new Response('Not Found', { status: 404 });
    }

    const req = new BunnerRequest({
      request: rawReq,
      server,
      params: route.params,
      queryParams: route.searchParams,
    });
    const res = new BunnerResponse(req);
    const ctx: MiddlewareContext = {
      req,
      res,
      path: req.path,
      app: this,
    };
    const finalizeEarly = async (res: BunnerResponse) => {
      res.build();

      await this.middlewareProvider.executePhase(ctx, 'afterResponse', ctx.path);

      return res.toResponse();
    };

    try {
      const onRequestResult = await this.middlewareProvider.executePhase(ctx, 'onRequest', ctx.path);

      if (onRequestResult instanceof BunnerResponse) {
        return finalizeEarly(onRequestResult);
      }
    } catch {
      finalizeEarly(res);

      return new Response('Internal Server Error', { status: 500 });
    }

    try {
      const beforeHandlerResult = await this.middlewareProvider.executePhase(ctx, 'beforeHandler', ctx.path);
      if (beforeHandlerResult instanceof BunnerResponse) {
        return finalizeEarly(beforeHandlerResult);
      }
    } catch {
      finalizeEarly(res);

      return new Response('Internal Server Error', { status: 500 });
    }

    try {
      const precomputed: PhaseMiddlewareMap = this.middlewareProvider.getPhaseMap(route.originalHandler) || {
        onRequest: [],
        beforeHandler: [],
        afterHandler: [],
        afterResponse: [],
      };

      if (precomputed.beforeHandler?.length) {
        const early = await this.middlewareProvider.executeGroups(ctx, 'beforeHandler', precomputed.beforeHandler);

        if (early instanceof BunnerResponse) {
          return finalizeEarly(early);
        }
      }

      const result = await RequestContext.runWithContainer(this.container.createRequestContainer() as any, () => route.handler(req, res));

      if (!(result instanceof BunnerResponse)) {
        res.setBody(result);
      }

      res.build();

      if (precomputed.afterHandler?.length) {
        await this.middlewareProvider.executeGroups(ctx, 'afterHandler', precomputed.afterHandler.reverse());
      }

      await this.middlewareProvider.executePhase(ctx, 'afterHandler', ctx.path);
      await this.middlewareProvider.executePhase(ctx, 'afterResponse', ctx.path);

      return res.toResponse();
    } catch (e) {
      finalizeEarly(res);

      return new Response('Internal Server Error', { status: 500 });
    }
  }

  addGlobalMiddlewares(options: GlobalMiddlewareOptions) {
    this.middlewareProvider.addGlobalMiddlewares(options);
  }

  addRouteMiddlewares(options: RouteMiddlewareOptions) {
    this.middlewareProvider.addRouteMiddlewares(options);
  }
}
