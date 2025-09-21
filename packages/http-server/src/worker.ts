import { BaseWorker, Container, LogLevel, type WorkerId } from '@bunner/core';
import { Logger } from '@bunner/core-logger';
import { expose } from 'comlink';

import { HttpError } from './errors';
import { Ffi } from './ffi';
import type { WorkerInitParams } from './interfaces';
import { RouteHandler } from './route-handler';

export class Worker extends BaseWorker {
  private readonly logger = new Logger();
  private id: WorkerId;
  private container: Container;
  private ffi: Ffi;
  private routeHandler: RouteHandler;

  constructor() {
    super();
  }

  getId() {
    return this.id;
  }

  async init(workerId: WorkerId, params: WorkerInitParams) {
    console.log('🔧 Worker is initializing...');

    this.id = workerId;

    const rootModuleCls = await import(params.rootModuleFile.path).then(
      mod => mod[params.rootModuleFile.className],
    );

    this.container = new Container(rootModuleCls);
    await this.container.init();

    this.ffi = new Ffi(this.id, {
      appName: params.options.appName,
      logLevel: params.options.logLevel ?? LogLevel.Info,
      workers: params.options.workers,
      queueCapacity: params.options.queueCapacity,
    });
    this.ffi.init();

    this.routeHandler = new RouteHandler(this.container, this.ffi);
    this.routeHandler.register();
  }

  bootstrap() {
    console.log('🚀 Worker is bootstrapping...');

    this.ffi.sealRoutes();
    this.ffi.dispatchRequestCallback();
  }

  async handleRequest(params: any) {
    try {
      await this.ffi.handleRequest({
        httpMethod: params.httpMethod,
        url: params.url,
        headers: params.headers,
        body: params.body,
      });

      /* const handler = this.routeHandler.find(handleResult.routeKey);

      if (!handler) {
        throw new NotFoundError();
      }
 */
      /*       const request = new BunnerRequest(handleResult.request, rawReq, server);
      const response = new BunnerResponse(request);
 */
      //      await handler();

      return 'hello';
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
    } catch (e: any) {
      this.logger.error(e);

      if (e instanceof HttpError) {
        //        return new Response(e.message, { status: e.statusCode });
      } else if (e instanceof Error) {
        //      return new Response(e.message, { status: 500 });
      }

      //  return new Response('Internal server error', { status: 500 });
    }
  }

  shutdown() {
    this.ffi.destroy();
  }
}

expose(new Worker());
