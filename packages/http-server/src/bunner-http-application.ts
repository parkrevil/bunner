import { BaseApplication, type BaseModule, type Class } from '@bunner/core';
import { Logger } from '@bunner/core-logger';
import type { Server } from 'bun';

import { HttpError } from './errors';
import { Ffi } from './ffi';
import { RouteHandler } from './route-handler';

export class BunnerHttpServer extends BaseApplication {
  private readonly logger = new Logger();
  private server: Server | undefined;
  private ffi: Ffi;
  private routeHandler: RouteHandler;

  constructor(rootModule: Class<BaseModule>) {
    super(rootModule);

    this.server = undefined;
    this.ffi = new Ffi();
    this.routeHandler = new RouteHandler(this.container, this.ffi);
  }

  /**
   * Initialize the server
   */
  override async init() {
    await super.init();

    this.ffi.init();
    this.routeHandler.register();
  }

  /**
   * Start the server
   */
  start() {
    this.ffi.buildRoutes();

    this.server = Bun.serve({
      port: 5000,
      fetch: this.onRequest.bind(this),
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
    this.ffi.destroy();

    this.server = undefined;
  }

  /**
   * On request
   * @param rawReq - The raw request object
   * @param server - The server object
   * @returns The response object
   */
  private async onRequest(rawReq: Request, server: Server) {
    try {
      const {
        handler,
        request: req,
        response: res,
      } = await this.routeHandler.findHandler(rawReq, server);

      // want to GC
      rawReq = null as any;

      const result = await handler(req, res);

      /* 
const handlerResult = await handler(req, res);

if (handlerResult instanceof Response) {
return handlerResult;
}

if (res.isSent) {
return res.getResponse();
}
res.send(handlerResult);
return res.getResponse();
*/
      //          const result = await handler();

      return new Response(result, { status: 200 });
    } catch (e: any) {
      this.logger.error(e);

      if (e instanceof HttpError) {
        return new Response(e.message, { status: e.statusCode });
      } else if (e instanceof Error) {
        return new Response(e.message, { status: 500 });
      }

      return new Response('Internal server error', { status: 500 });
    }
  }
}
