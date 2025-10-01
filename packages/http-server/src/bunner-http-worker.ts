import { BaseWorker, Container, LogLevel, type WorkerId } from '@bunner/core';
import { Logger } from '@bunner/core-logger';
import { expose } from 'comlink';
import { StatusCodes } from 'http-status-codes';

import { BunnerRequest } from './bunner-request';
import { BunnerResponse } from './bunner-response';
import { HttpError } from './errors';
import { Ffi, type HandleRequestParams } from './ffi';
import type { WorkerInitParams } from './interfaces';
import { RouteHandler } from './route-handler';

export class BunnerHttpWorker extends BaseWorker {
  private readonly logger = new Logger();
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
    console.log(`🔧 Bunner HTTP Worker #${workerId} is initializing...`);

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
    console.log(`🚀 Bunner HTTP Worker #${this.id} is bootstrapping...`);

    this.ffi.sealRoutes();
    this.ffi.dispatchRequestCallback();
  }

  async handleRequest(params: HandleRequestParams) {
    try {
      const {
        request: ffiReq,
        response: ffiRes,
        routeKey,
      } = await this.ffi.handleRequest(params);
      const req = new BunnerRequest(ffiReq);
      const res = new BunnerResponse(req, ffiRes);

      if (res.isSent()) {
        throw res;
      }

      if (routeKey === 0) {
        throw res.setStatus(StatusCodes.NOT_FOUND);
      }

      const handler = this.routeHandler.find(routeKey);

      if (!handler) {
        throw res.setStatus(StatusCodes.NOT_FOUND);
      }

      const result = await handler();

      if (result instanceof Response || res.isSent()) {
        throw res;
      }

      return res.setBody(result).end();
    } catch (e: any) {
      this.logger.error(e);

      if (e instanceof BunnerResponse) {
        return e.end();
      }

      if (e instanceof HttpError) {
        //        return new Response(e.message, { status: e.statusCode });
      } else if (e instanceof Error) {
        //      return new Response(e.message, { status: 500 });
      }

      //  return new Response('Internal server error', { status: 500 });
    }
  }

  destroy() {
    console.log(`🛑 Worker #${this.id} is destroying...`);

    this.ffi.destroy();
  }
}

expose(new BunnerHttpWorker());
