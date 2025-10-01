import { BaseWorker, BunnerError, BunnerFfiError, Container, LogLevel, type WorkerId } from '@bunner/core';
import { Logger } from '@bunner/core-logger';
import { expose } from 'comlink';
import { StatusCodes } from 'http-status-codes';

import { BunnerRequest } from './bunner-request';
import { BunnerResponse } from './bunner-response';
import { HttpError } from './errors';
import { Ffi, type HandleRequestParams } from './ffi';
import type { HttpWorkerResponse, RouteHandlerEntry, WorkerInitParams } from './interfaces';
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

    const rootModuleCls = await import(params.rootModuleFile.path).then(mod => mod[params.rootModuleFile.className]);

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

  async handleRequest(params: HandleRequestParams): Promise<HttpWorkerResponse> {
    try {
      const { request: ffiReq, response: ffiRes, routeKey } = await this.ffi.handleRequest(params);
      const req = new BunnerRequest(ffiReq);
      const res = new BunnerResponse(req, ffiRes);

      if (res.isSent()) {
        return res.getWorkerResponse();
      }

      if (isNaN(routeKey)) {
        return res.setStatus(StatusCodes.NOT_FOUND).end();
      }

      const routeEntry = this.routeHandler.find(routeKey);

      if (!routeEntry) {
        return res.setStatus(StatusCodes.NOT_FOUND).end();
      }

      const result = await routeEntry.handler(...this.buildRouteHandlerParams(routeEntry, req, res));

      if (result instanceof Response || res.isSent()) {
        return res.end();
      }

      return res.setBody(result).end();
    } catch (e: any) {
      console.log(e);

      if (e instanceof BunnerFfiError) {
        //
      } else if (e instanceof BunnerError) {
        //
      } else if (e instanceof HttpError) {
        //
      } else if (e instanceof Error) {
        //
      } else {
        //
      }

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

  /**
   * Builds the parameters for the route handler.
   * @param entry The route handler entry.
   * @param req The Bunner request.
   * @param res The Bunner response.
   * @returns The parameters for the route handler.
   */
  private buildRouteHandlerParams(entry: RouteHandlerEntry, req: BunnerRequest, res: BunnerResponse): any {
    const params = [];

    for (const type of entry.paramType) {
      switch (type) {
        case 'body':
          params.push(req.body);
          break;

        case 'param':
          params.push(req.params);
          break;

        case 'query':
          params.push(req.queryParams);
          break;

        case 'header':
          params.push(req.headers);
          break;

        case 'cookie':
          params.push(req.cookies);
          break;

        case 'request':
          params.push(req);
          break;

        case 'response':
          params.push(res);
          break;

        case 'ip':
          params.push(req.ip);
          break;

        default:
          params.push(undefined);
          break;
      }
    }

    return params;
  }
}

expose(new BunnerHttpWorker());
