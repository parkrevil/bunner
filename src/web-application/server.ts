import type { Server } from 'bun';
import type { BunnerWebServerStartOptions } from './interfaces';
import { BunnerRequest } from './request';
import { BunnerResponse } from './response';
import { Router } from './router';
import type { HttpMethodType } from './types';

export class BunnerWebServer {
  private readonly router: Router;
  private server: Server;

  constructor() {
    this.router = new Router();
  }

  /**
   * Start the server
   * @param options - The options for the server
   * @returns A promise that resolves to true if the server started successfully
   */
  start(options: BunnerWebServerStartOptions) {
    this.router.build();

    this.server = Bun.serve({
      fetch: async (rawReq: Request, server: Server) => {
        const route = this.router.find(rawReq.method as HttpMethodType, rawReq.url);

        if (!route) {
          return new Response('Not Found', { status: 404 });
        }

        const bunnerRequest = new BunnerRequest({
          request: rawReq,
          server,
          params: route.params,
          queryParams: route.searchParams,
        });
        const bunnerResponse = new BunnerResponse();
        const result = await route.handler(bunnerRequest, bunnerResponse);

        return new Response(result);
      },
      ...options,
    });
  }

  /**
   * Stop the server
   * @param force - Whether to force the server to close
   */
  async stop(force = false) {
    if (!this.server) {
      return;
    }

    force && this.server.unref();

    await this.server.stop(force);
  }
}
