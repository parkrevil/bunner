import {
  BaseWorker,
  BunnerError,
  BunnerFfiError,
  Container,
  LogLevel,
  type WorkerId,
} from '@bunner/core';
import { Logger } from '@bunner/core-logger';
import { expose } from 'comlink';
import { StatusCodes } from 'http-status-codes';

import { BunnerRequest } from './bunner-request';
import { BunnerResponse } from './bunner-response';
import { HttpError } from './errors';
import { Ffi, type HandleRequestParams } from './ffi';
import type { HttpWorkerResponse, WorkerInitParams } from './interfaces';
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

  async handleRequest(
    params: HandleRequestParams,
  ): Promise<HttpWorkerResponse> {
    try {
      const {
        request: ffiReq,
        response: ffiRes,
        routeKey,
      } = await this.ffi.handleRequest(params);

      console.log('2');
      const req = new BunnerRequest(ffiReq);
      const res = new BunnerResponse(req, ffiRes);
      console.log('3');
      if (res.isSent()) {
        return res.getWorkerResponse();
      }

      if (routeKey === 0) {
        return res.setStatus(StatusCodes.NOT_FOUND).end();
      }

      const handler = this.routeHandler.find(routeKey);

      if (!handler) {
        return res.setStatus(StatusCodes.NOT_FOUND).end();
      }

      const result = await handler();

      if (result instanceof Response || res.isSent()) {
        return res.end();
      }

      res.setBody(result).end();

      console.log(res.getWorkerResponse());

      return res.getWorkerResponse();
    } catch (e: any) {
      console.log(e);

      if (e instanceof BunnerFfiError) {
        console.log('a');
      } else if (e instanceof BunnerError) {
        console.log('b');
      } else if (e instanceof HttpError) {
        console.log('c');
      } else if (e instanceof Error) {
        console.log('d');
      } else {
        console.log('e');
      }

      console.log('ddddddd');

      return {
        body: '',
        init: { status: StatusCodes.INTERNAL_SERVER_ERROR },
      };
    }
  }

  destroy() {
    console.log(`🛑 Worker #${this.id} is destroying...`);

    this.ffi.destroy();
  }
}

expose(new BunnerHttpWorker());
