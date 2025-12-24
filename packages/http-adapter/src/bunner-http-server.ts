import { type BunnerContainer } from '@bunner/common';
import { Logger } from '@bunner/logger';
import type { Server } from 'bun';
import { StatusCodes } from 'http-status-codes';

import { BunnerRequest } from './bunner-request';
import { BunnerResponse } from './bunner-response';
import { HttpMethod } from './enums';
import type { BunnerHttpMiddleware, BunnerHttpServerOptions } from './interfaces';
import { RequestHandler } from './request-handler';
import { RouteHandler } from './route-handler';
import { getIps } from './utils';

export class BunnerHttpServer {
  private container: BunnerContainer;
  private routeHandler: RouteHandler;
  private requestHandler: RequestHandler;
  private logger = new Logger(BunnerHttpServer.name);

  private options: BunnerHttpServerOptions; // Updated type
  private server: Server<any>;

  private middlewares: {
    beforeRequest: BunnerHttpMiddleware[];
    afterRequest: BunnerHttpMiddleware[];
    beforeHandler: BunnerHttpMiddleware[]; // Not used yet? Plan implies usage.
    beforeResponse: BunnerHttpMiddleware[];
    afterResponse: BunnerHttpMiddleware[];
  } = {
    beforeRequest: [],
    afterRequest: [],
    beforeHandler: [],
    beforeResponse: [],
    afterResponse: [],
  };

  async boot(container: BunnerContainer, options: any) {
    this.container = container;
    this.options = options.options || options; // Handle nested options

    if ((this.options as any).middlewares) {
      this.middlewares = (this.options as any).middlewares;
    }

    this.logger.info('🚀 BunnerHttpServer booting...');

    const metadataRegistry = (options).metadata || new Map();
    const scopedKeysMap = (options).scopedKeys || new Map();

    this.routeHandler = new RouteHandler(this.container, metadataRegistry, scopedKeysMap);
    this.routeHandler.register();

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
      // 1. beforeRequest
      await this.runMiddlewares(this.middlewares.beforeRequest, bunnerReq, bunnerRes);

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
      await this.runMiddlewares(this.middlewares.afterRequest, bunnerReq, bunnerRes);

      // 3. beforeHandler (Pre-Routing/Handling)
      await this.runMiddlewares(this.middlewares.beforeHandler, bunnerReq, bunnerRes);

      // Handle Request
      const workerRes = await this.requestHandler.handle(bunnerReq, bunnerRes, httpMethod, path);

      // 4. beforeResponse
      await this.runMiddlewares(this.middlewares.beforeResponse, bunnerReq, bunnerRes);

      const response = new Response(workerRes.body, workerRes.init);
      
      // 5. afterResponse (Note: Response is immutable in standard Request/Response, 
      // but we can execute logic here. However, we've already created the Response object.)
      await this.runMiddlewares(this.middlewares.afterResponse, bunnerReq, bunnerRes);

      return response;

    } catch (e: any) {
      this.logger.error('Fetch Error', e);
      return new Response('Internal server error', {
        status: StatusCodes.INTERNAL_SERVER_ERROR,
      });
    }
  }

  private async runMiddlewares(middlewares: BunnerHttpMiddleware[], req: BunnerRequest, res: BunnerResponse): Promise<void> {
    for (const middleware of middlewares) {
      await middleware.handle(req, res);
    }
  }
}
