import { BaseWorker, Container, type WorkerId, type Middleware, type ErrorHandler, type Context } from '@bunner/core';
import { Logger } from '@bunner/logger';
import { expose } from 'comlink';
import { StatusCodes } from 'http-status-codes';

import { BunnerHttpAdapter } from './adapter/bunner-http-adapter';
import { HttpContext } from './adapter/http-context';
import { BunnerRequest } from './bunner-request';
import { BunnerResponse } from './bunner-response';
import { HTTP_AFTER_RESPONSE, HTTP_BEFORE_REQUEST, HTTP_BEFORE_RESPONSE, HTTP_ERROR_HANDLER } from './constants';
import { HttpMethod } from './enums';
import type { HttpWorkerResponse, RouteHandlerEntry } from './interfaces';
import { ValidationPipe } from './pipes/validation.pipe';
import { RouteHandler } from './route-handler';

export class BunnerHttpWorker extends BaseWorker {
  private container: Container;
  private routeHandler: RouteHandler;
  private logger = new Logger(BunnerHttpWorker);
  private validationPipe = new ValidationPipe();
  private metadataRegistry: Map<any, any> | undefined;

  private globalBeforeRequest: Middleware[] = [];
  private globalBeforeResponse: Middleware[] = [];
  private globalAfterResponse: Middleware[] = [];
  private globalErrorHandlers: ErrorHandler[] = [];

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
      this.metadataRegistry = manifest.createMetadataRegistry() || new Map();

      if (typeof manifest.registerDynamicModules === 'function') {
        this.logger.info('⚡ Loading Dynamic Modules...');
        await manifest.registerDynamicModules(this.container);
      }

      let scopedKeysMap = new Map();
      if (typeof manifest.createScopedKeysMap === 'function') {
        scopedKeysMap = manifest.createScopedKeysMap();
      } else {
        this.logger.warn('⚠️  Manifest does not support Scoped Keys. Running in legacy mode.');
      }

      this.routeHandler = new RouteHandler(this.container, this.metadataRegistry || new Map(), scopedKeysMap);
    } else {
      this.logger.warn('Legacy init not supported in AOT Core yet.');
      this.container = new Container();
      this.routeHandler = new RouteHandler(this.container, new Map());
    }

    this.routeHandler.register();
    this.loadMiddlewares();
  }

  bootstrap() {
    this.logger.info(`🚀 Bunner HTTP Worker #${this.id} is bootstrapping...`);
  }

  async handleRequest(params: any): Promise<HttpWorkerResponse> {
    const { httpMethod, url, headers, body, request: reqContext } = params;

    const urlObj = new URL(url, 'http://localhost');
    const path = urlObj.pathname;
    const methodStr = HttpMethod[httpMethod] || 'GET';

    const adaptiveReq = {
      httpMethod: httpMethod,
      url: url,
      headers: headers,
      body: body,
      queryParams: Object.fromEntries(urlObj.searchParams.entries()),
      params: {},
      ...reqContext,
    };

    const req = new BunnerRequest(adaptiveReq);
    const res = new BunnerResponse(req, { headers: new Headers(), status: 0 } as any);
    const adapter = new BunnerHttpAdapter(req, res);
    const context = new HttpContext(adapter);

    let matchResult: any = undefined;

    try {
      // 1. Global Before Request
      await this.runMiddlewares(this.globalBeforeRequest, context);

      // 2. Routing
      matchResult = this.routeHandler.match(methodStr, path);

      if (!matchResult) {
        throw new Error(`Route not found: ${methodStr} ${path}`); // TODO: NotFoundError
        // We throw generic Error here to be caught by ErrorHandler if generic one exists,
        // or we handle 404 explicitly. For now let's throw.
      }

      // @ts-expect-error: params is dynamically assigned from router
      req.params = matchResult.params;

      // 3. Scoped Middlewares (Before Handler)
      const scopedMiddlewares = this.resolveScopedMiddlewares(matchResult.entry);
      await this.runMiddlewares(scopedMiddlewares, context);

      this.logger.debug(`Matched Route: ${methodStr.toUpperCase()}:${path}`);

      // 4. Handler
      const routeEntry = matchResult.entry;
      const result = await routeEntry.handler(...(await this.buildRouteHandlerParams(routeEntry, req, res)));

      if (result instanceof Response) {
        // If raw Response is returned, it bypasses standard flow?
        // We should probably allow middleware interception still by setting it to res body if possible?
        // But Adapter uses BunnerResponse.
        // Let's assume user returns body content.
        // If they return Response, we treat it as final.
        return {
          body: await result.text(),
          init: { status: result.status, headers: result.headers.toJSON() },
        };
      }
      if (result !== undefined) {
        res.setBody(result);
      }
    } catch (e: any) {
      const handled = await this.runErrorHandlers(e, context, matchResult?.entry);
      if (!handled) {
        this.logger.error('Unhandled Error', e);
        return {
          body: 'Internal Server Error',
          init: { status: StatusCodes.INTERNAL_SERVER_ERROR },
        };
      }
    }

    // 5. Before Response
    try {
      await this.runMiddlewares(this.globalBeforeResponse, context);
    } catch (e) {
      this.logger.error('Error in beforeResponse', e);
    }

    // 6. After Response
    try {
      await this.runMiddlewares(this.globalAfterResponse, context);
    } catch (e) {
      this.logger.error('Error in afterResponse', e);
    }

    if (res.isSent()) {
      return res.getWorkerResponse();
    }
    return res.end();
  }

  destroy() {
    this.logger.info(`🛑 Worker #${this.id} is destroying...`);
  }

  private async runMiddlewares(middlewares: Middleware[], ctx: Context) {
    for (const mw of middlewares) {
      await mw.handle(ctx);
    }
  }

  private resolveScopedMiddlewares(entry: RouteHandlerEntry): Middleware[] {
    if (!this.metadataRegistry) {
      return [];
    }

    const middlewares: Middleware[] = [];

    // Method Level
    const methodMeta = this.metadataRegistry.get(entry.controllerClass)?.methods.find((m: any) => m.name === entry.methodName);
    if (methodMeta) {
      const decs = methodMeta.decorators.filter((d: any) => d.name === 'UseMiddlewares');
      decs.forEach((d: any) => {
        (d.arguments || []).forEach((arg: any) => {
          // Need to resolve instance from container?
          // Decorator arguments in AOT are usually references or strings.
          // If it's a class reference, AstParser stores it.
          // We need to resolve it effectively.
          // But wait, UseMiddlewares(MyMiddleware). MyMiddleware is a class.
          // In AOT metadata, 'arguments' might be string names "MyMiddleware".
          // We need to `container.get(MyMiddleware)`.
          // But `MyMiddleware` symbol might not be available here as value.
          // We only have string names if not carefully handled.
          // AstParser tries to resolve types.
          // Let's assume for now we primarily support Global Middlewares and will fix Scoped later if complex.
          // Wait, I should support it.
          // If `d.arguments` contains a class constructor (if runtime), we use it.
          // If we are in AOT environment, `entry.controllerClass` is a real class constructor.
          // MetadataRegistry has `decorators`.
          // If we run `manifest.ts`, decorators are evaluated.
          // `UseMiddlewares(MiddlewareClass)` -> `arguments` will have the Class Constructor.
          // So we can do `this.container.get(arg)`.
          try {
            const mw = this.container.get(arg);
            if (mw) {
              middlewares.push(mw);
            }
          } catch {}
        });
      });
    }

    // Controller Level (Class decorators in metadata likely stored on class)
    const classMeta = this.metadataRegistry.get(entry.controllerClass);
    if (classMeta) {
      const decs = classMeta.decorators.filter((d: any) => d.name === 'UseMiddlewares');
      decs.forEach((d: any) => {
        (d.arguments || []).forEach((arg: any) => {
          try {
            const mw = this.container.get(arg);
            if (mw) {
              middlewares.push(mw);
            }
          } catch {}
        });
      });
    }

    return middlewares;
  }

  private async runErrorHandlers(error: any, ctx: Context, entry?: RouteHandlerEntry): Promise<boolean> {
    // 1. Scoped Handlers
    let handlers: ErrorHandler[] = [];

    if (entry && this.metadataRegistry) {
      // Method handlers
      const methodMeta = this.metadataRegistry.get(entry.controllerClass)?.methods.find((m: any) => m.name === entry.methodName);
      if (methodMeta) {
        const decs = methodMeta.decorators.filter((d: any) => d.name === 'UseErrorHandlers');
        decs.forEach((d: any) =>
          (d.arguments || []).forEach((arg: any) => {
            try {
              const h = this.container.get(arg);
              if (h) {
                handlers.push(h);
              }
            } catch {}
          }),
        );
      }
      // Controller handlers
      const classMeta = this.metadataRegistry.get(entry.controllerClass);
      if (classMeta) {
        const decs = classMeta.decorators.filter((d: any) => d.name === 'UseErrorHandlers');
        decs.forEach((d: any) =>
          (d.arguments || []).forEach((arg: any) => {
            try {
              const h = this.container.get(arg);
              if (h) {
                handlers.push(h);
              }
            } catch {}
          }),
        );
      }
    }

    // 2. Global Handlers
    handlers = [...handlers, ...this.globalErrorHandlers];

    for (const handler of handlers) {
      // Check @Catch
      // We need metadata for the HANDLER class.
      // `this.metadataRegistry.get(handler.constructor)`?
      // Yes, if handler is an instance.
      const meta = this.metadataRegistry?.get(handler.constructor);
      const catchDec = meta?.decorators.find((d: any) => d.name === 'Catch');

      // If no @Catch, does it catch everything? Or nothing?
      // Usually @Catch() empty means everything.
      // If @Catch(ValidationError), it catches only that.

      let shouldCatch = false;
      if (!catchDec || catchDec.arguments.length === 0) {
        shouldCatch = true; // Catch all
      } else {
        shouldCatch = catchDec.arguments.some((exceptionType: any) => error instanceof exceptionType);
      }

      if (shouldCatch) {
        await handler.catch(error, ctx);
        return true;
      }
    }

    return false;
  }

  private async buildRouteHandlerParams(entry: RouteHandlerEntry, req: BunnerRequest, res: BunnerResponse): Promise<any[]> {
    const params = [];

    for (let i = 0; i < entry.paramType.length; i++) {
      const type = entry.paramType[i] as string;
      const metatype = entry.paramRefs[i];
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

      if (metatype && (type === 'body' || type === 'query')) {
        paramValue = await this.validationPipe.transform(paramValue, {
          type: type as any,
          metatype,
          data: undefined,
        });
      }

      params.push(paramValue);
    }

    return params;
  }

  private loadMiddlewares() {
    this.globalBeforeRequest = this.resolveTokens<Middleware>(HTTP_BEFORE_REQUEST);
    this.globalBeforeResponse = this.resolveTokens<Middleware>(HTTP_BEFORE_RESPONSE);
    this.globalAfterResponse = this.resolveTokens<Middleware>(HTTP_AFTER_RESPONSE);
    this.globalErrorHandlers = this.resolveTokens<ErrorHandler>(HTTP_ERROR_HANDLER);
  }

  private resolveTokens<T>(token: string): T[] {
    const results: T[] = [];

    // 1. Direct match (Global/Legacy)
    if (this.container.has(token)) {
      try {
        const result = this.container.get(token);
        if (result) {
          if (Array.isArray(result)) {
            results.push(...result);
          } else {
            results.push(result);
          }
        }
      } catch {}
    }

    // 2. Namespaced match (Module::Token)
    for (const key of this.container.keys()) {
      if (typeof key === 'string' && key.endsWith(`::${token}`)) {
        try {
          const result = this.container.get(key);
          if (result) {
            if (Array.isArray(result)) {
              results.push(...result);
            } else {
              results.push(result);
            }
          }
        } catch {}
      }
    }

    return results;
  }
}

expose(new BunnerHttpWorker());
