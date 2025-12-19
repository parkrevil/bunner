import { BaseWorker, BunnerError, Container, type WorkerId } from '@bunner/core';
import { expose } from 'comlink';
import { StatusCodes } from 'http-status-codes';

import { BunnerRequest } from './bunner-request';
import { BunnerResponse } from './bunner-response';
import { HttpError } from './errors';
import type { HttpWorkerResponse, RouteHandlerEntry, WorkerInitParams } from './interfaces';
import { RouteHandler } from './route-handler';

export class BunnerHttpWorker extends BaseWorker {
  private container: Container;
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

    if (params.rootModuleFile.manifestPath) {
      // AOT Mode
      console.log(`⚡ AOT Worker Load: ${params.rootModuleFile.manifestPath}`);
      const manifest = await import(params.rootModuleFile.manifestPath);

      this.container = manifest.createContainer();
      const metadataRegistry = manifest.createMetadataRegistry();

      this.routeHandler = new RouteHandler(this.container, metadataRegistry);
    } else {
      // Legacy Mode (Dynamic)
      console.warn('Legacy init not supported in AOT Core yet.');
      this.container = new Container();
      this.routeHandler = new RouteHandler(this.container, new Map());
    }

    this.routeHandler.register();
  }

  bootstrap() {
    console.log(`🚀 Bunner HTTP Worker #${this.id} is bootstrapping...`);
  }

  async handleRequest(_params: any): Promise<HttpWorkerResponse> {
    try {
      const { request: ffiReq, response: ffiRes, routeKey } = {} as any;
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

      if (e instanceof BunnerError) {
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
  }

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
