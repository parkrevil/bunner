import { type Container } from '@bunner/core';
import { Logger } from '@bunner/logger';
import type { Server } from 'bun';
import { StatusCodes } from 'http-status-codes';

import { BunnerRequest } from './bunner-request';
import { BunnerResponse } from './bunner-response';
import { HttpMethod } from './enums';
import { RequestHandler } from './request-handler';
import { RouteHandler } from './route-handler';
import { getIps } from './utils';

export class BunnerHttpServer {
  private container: Container;
  private routeHandler: RouteHandler;
  private requestHandler: RequestHandler;
  private logger = new Logger(BunnerHttpServer.name);

  private options: any;
  private server: Server<any>;

  async boot(container: Container, options: any) {
    this.container = container;
    this.options = options.options || options; // Handle nested options if necessary

    this.logger.info('🚀 BunnerHttpServer booting...');

    // Resolve Metadata Registry from Container or Global if available
    const metadataRegistry = options.metadata || new Map();
    const scopedKeysMap = options.scopedKeys || new Map();

    this.routeHandler = new RouteHandler(this.container, metadataRegistry, scopedKeysMap);
    this.routeHandler.register();

    this.requestHandler = new RequestHandler(this.container, this.routeHandler, metadataRegistry);

    const serveOptions = {
      port: this.options.port,
      reusePort: this.options.reusePort ?? true,
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
      const urlObj = new URL(req.url, 'http://localhost');
      const path = urlObj.pathname;

      const adaptiveReq = {
        httpMethod,
        url: req.url,
        headers: req.headers.toJSON(),
        body,
        queryParams: Object.fromEntries(urlObj.searchParams.entries()),
        params: {},
        ip,
        ips,
        isTrustedProxy: this.options.trustProxy,
      };

      const bunnerReq = new BunnerRequest(adaptiveReq);
      const bunnerRes = new BunnerResponse(bunnerReq, { headers: new Headers(), status: 0 } as any);

      const workerRes = await this.requestHandler.handle(bunnerReq, bunnerRes, httpMethod, path);

      return new Response(workerRes.body, workerRes.init);
    } catch (e: any) {
      this.logger.error('Fetch Error', e);
      return new Response('Internal server error', {
        status: StatusCodes.INTERNAL_SERVER_ERROR,
      });
    }
  }
}
