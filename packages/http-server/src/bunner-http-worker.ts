import { BaseWorker, Container, type WorkerId } from '@bunner/core';
import { Logger } from '@bunner/logger';
import { expose } from 'comlink';
import { StatusCodes } from 'http-status-codes';

import { BunnerRequest } from './bunner-request';
import { BunnerResponse } from './bunner-response';
import { HttpMethod } from './enums';
import type { HttpWorkerResponse, RouteHandlerEntry } from './interfaces';
import { ValidationPipe } from './pipes/validation.pipe';
import { RouteHandler } from './route-handler';

// ... class ...
export class BunnerHttpWorker extends BaseWorker {
  private container: Container;
  private routeHandler: RouteHandler;
  private logger = new Logger(BunnerHttpWorker);
  private validationPipe = new ValidationPipe();

  constructor() {
    super();
  }

  getId() {
    return this.id;
  }

  override async init(workerId: WorkerId, params: any) {
    this.logger.info(`🔧 Bunner HTTP Worker #${workerId} is initializing...`);

    this.id = workerId;

    if (params.rootModuleFile.manifestPath) {
      this.logger.info(`⚡ AOT Worker Load: ${params.rootModuleFile.manifestPath}`);
      const manifest = await import(params.rootModuleFile.manifestPath);

      this.container = manifest.createContainer();
      const metadataRegistry = manifest.createMetadataRegistry();

      // Register Dynamic Modules (New AOT Feature)
      if (typeof manifest.registerDynamicModules === 'function') {
        this.logger.info('⚡ Loading Dynamic Modules...');
        await manifest.registerDynamicModules(this.container);
      }

      // Load Scoped Keys Map if available (New AOT Feature)
      let scopedKeysMap = new Map();
      if (typeof manifest.createScopedKeysMap === 'function') {
        scopedKeysMap = manifest.createScopedKeysMap();
      } else {
        this.logger.warn('⚠️  Manifest does not support Scoped Keys. Running in legacy mode.');
      }

      this.routeHandler = new RouteHandler(this.container, metadataRegistry, scopedKeysMap);
    } else {
      this.logger.warn('Legacy init not supported in AOT Core yet.');
      this.container = new Container();
      this.routeHandler = new RouteHandler(this.container, new Map());
    }

    this.routeHandler.register();
  }

  bootstrap() {
    this.logger.info(`🚀 Bunner HTTP Worker #${this.id} is bootstrapping...`);
  }

  async handleRequest(params: any): Promise<HttpWorkerResponse> {
    try {
      const { httpMethod, url, headers, body, request: reqContext } = params;

      const urlObj = new URL(url, 'http://localhost');
      const path = urlObj.pathname;
      const methodStr = HttpMethod[httpMethod] || 'GET';

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
        this.logger.warn(`Route not found: ${methodStr.toUpperCase()}:${path}`);
        return res.setStatus(StatusCodes.NOT_FOUND).end();
      }

      this.logger.debug(`Matched Route: ${methodStr.toUpperCase()}:${path}`);

      const routeEntry = match.entry;
      const result = await routeEntry.handler(...(await this.buildRouteHandlerParams(routeEntry, req, res)));

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
      this.logger.error('handleRequest Error', e);
      return {
        body: 'Internal Server Error',
        init: { status: StatusCodes.INTERNAL_SERVER_ERROR },
      };
    }
  }

  destroy() {
    this.logger.info(`🛑 Worker #${this.id} is destroying...`);
  }

  private async buildRouteHandlerParams(entry: RouteHandlerEntry, req: BunnerRequest, res: BunnerResponse): Promise<any[]> {
    const params = [];

    for (let i = 0; i < entry.paramType.length; i++) {
      const type = entry.paramType[i] as string;
      const metatype = entry.paramRefs[i]; // Get Type Reference
      let paramValue = undefined;

      switch (type) {
        case 'body':
          paramValue = req.body;
          break;
        case 'param':
        case 'params':
          paramValue = req.params;
          break;
        case 'query':
        case 'queries':
          paramValue = req.queryParams;
          break;
        case 'header':
        case 'headers':
          paramValue = req.headers;
          break;
        case 'cookie':
        case 'cookies':
          paramValue = req.cookies;
          break;
        case 'request':
        case 'req':
          paramValue = req;
          break;
        case 'response':
        case 'res':
          paramValue = res;
          break;
        case 'ip':
          paramValue = req.ip;
          break;
        default:
          paramValue = undefined;
          break;
      }

      // Apply ValidationPipe for Body (and Query/Params if metatype is provided)
      // Currently focusing on Body validation as per plan
      if (metatype && (type === 'body' || type === 'query')) {
        paramValue = await this.validationPipe.transform(paramValue, {
          type: type as any,
          metatype,
          data: undefined, // We don't have deep param name info here easily yet
        });
      }

      params.push(paramValue);
    }

    return params;
  }
}

expose(new BunnerHttpWorker());
