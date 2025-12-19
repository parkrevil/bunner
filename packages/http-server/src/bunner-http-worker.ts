import { BaseWorker, Container, type WorkerId } from '@bunner/core';
import { expose } from 'comlink';
import { StatusCodes } from 'http-status-codes';

import { BunnerRequest } from './bunner-request';
import { BunnerResponse } from './bunner-response';
import { HttpMethod } from './enums';
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
      console.log(`⚡ AOT Worker Load: ${params.rootModuleFile.manifestPath}`);
      const manifest = await import(params.rootModuleFile.manifestPath);

      this.container = manifest.createContainer();
      const metadataRegistry = manifest.createMetadataRegistry();

      // Register Dynamic Modules (New AOT Feature)
      if (typeof manifest.registerDynamicModules === 'function') {
        console.log('⚡ Loading Dynamic Modules...');
        await manifest.registerDynamicModules(this.container);
      }

      // Load Scoped Keys Map if available (New AOT Feature)
      let scopedKeysMap = new Map();
      if (typeof manifest.createScopedKeysMap === 'function') {
        scopedKeysMap = manifest.createScopedKeysMap();
      } else {
        console.warn('⚠️  Manifest does not support Scoped Keys. Running in legacy mode.');
      }

      this.routeHandler = new RouteHandler(this.container, metadataRegistry, scopedKeysMap);
    } else {
      console.warn('Legacy init not supported in AOT Core yet.');
      this.container = new Container();
      this.routeHandler = new RouteHandler(this.container, new Map());
    }

    this.routeHandler.register();
  }

  bootstrap() {
    console.log(`🚀 Bunner HTTP Worker #${this.id} is bootstrapping...`);
  }

  async handleRequest(params: any): Promise<HttpWorkerResponse> {
    try {
      const { httpMethod, url, headers, body, request: reqContext } = params;

      const urlObj = new URL(url, 'http://localhost');
      const path = urlObj.pathname;
      const methodStr = HttpMethod[httpMethod];

      const match = this.routeHandler.match(methodStr, path);

      // Adaptive Request Object for BunnerRequest
      const adaptiveReq = {
        httpMethod: httpMethod,
        url: url,
        headers: headers,
        body: body,
        queryParams: Object.fromEntries(urlObj.searchParams.entries()),
        params: match ? match.params : {},
        ...reqContext,
      };

      const req = new BunnerRequest(adaptiveReq);
      const res = new BunnerResponse(req, {
        headers: new Headers(),
        status: 0,
      } as any);

      if (!match) {
        console.warn(`[Worker] Route not found: ${methodStr.toUpperCase()}:${path}`);
        return res.setStatus(StatusCodes.NOT_FOUND).end();
      }

      console.log(`[Worker] Matched Route: ${methodStr.toUpperCase()}:${path}`);

      const routeEntry = match.entry;
      const result = await routeEntry.handler(...this.buildRouteHandlerParams(routeEntry, req, res));

      if (result instanceof Response) {
        return {
          body: await result.text(),
          init: {
            status: result.status,
            statusText: result.statusText,
            headers: result.headers.toJSON(),
          },
        };
      }

      if (res.isSent()) {
        return res.getWorkerResponse();
      }

      return res.setBody(result).end();
    } catch (e: any) {
      console.error('[Worker] handleRequest Error:', e);
      return {
        body: 'Internal Server Error',
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
        case 'params':
          params.push(req.params);
          break;

        case 'query':
        case 'queries':
          params.push(req.queryParams);
          break;

        case 'header':
        case 'headers':
          params.push(req.headers);
          break;

        case 'cookie':
        case 'cookies':
          params.push(req.cookies);
          break;

        case 'request':
        case 'req':
          params.push(req);
          break;

        case 'response':
        case 'res':
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
