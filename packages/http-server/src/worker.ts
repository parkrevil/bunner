import { BaseWorker, Container, LogLevel } from '@bunner/core';
import { expose } from 'comlink';

import { Ffi } from './ffi';
import type { WorkerConstructParams } from './interfaces';
import { RouteHandler } from './route-handler';

export class Worker extends BaseWorker {
  private container: Container;
  private ffi: Ffi;
  private routeHandler: RouteHandler;

  construct(params: WorkerConstructParams) {
    //    this.container = new Container(params.rootModuleGetter());
    this.ffi = new Ffi({
      logLevel: params.options?.logLevel ?? LogLevel.Info,
    });
    this.routeHandler = new RouteHandler(this.container, this.ffi);
  }

  async init() {
    await Promise.all([this.container.init(), this.ffi.init()]);

    this.routeHandler.register();
  }

  start() {
    console.log('🚀 Worker is bootstrapping...');

    this.ffi.sealRoutes();
  }

  handleRequest() {
    console.log('handleRequest');
    /*     try {
      const {
        handler,
        request: req,
        response: res,
      } = await this.routeHandler.findHandler(rawReq, server);

      // want to GC
      rawReq = null as any;

      const result = await handler(req, res); */
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
    /*       return new Response(result, { status: 200 });
    } catch (e: any) {
      this.logger.error(e);

      if (e instanceof HttpError) {
        return new Response(e.message, { status: e.statusCode });
      } else if (e instanceof Error) {
        return new Response(e.message, { status: 500 });
      }

      return new Response('Internal server error', { status: 500 });
    } */
  }

  shutdown() {
    this.ffi.destroy();
  }
}

expose(new Worker());
