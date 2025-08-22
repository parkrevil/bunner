import type { BunRequest, Server } from 'bun';
import { EventEmitter } from "events";
import { ReasonPhrases, StatusCodes } from 'http-status-codes';
import { ApiDocumentBuilder } from './api-document-builder';
import { ContentType, HeaderField, HttpMethod } from './enums';
import type { ApiDocumentOptions, StaticConfig, StaticOptions } from './interfaces';
import { cors, type CorsOptions } from './middlewares/cors';
import { BunnerRequest } from './request';
import { BunnerResponse } from './response';
import type { BunnerServerOptions, BunRouteHandler, BunRouteValue, MiddlewareFn, RouteHandler, Routes, StaticRoutes } from './types';

export class Bunner extends EventEmitter {
  private readonly staticPathFilter = /^\/+|\/+$/g;
  private apiDocumentBuilder: ApiDocumentBuilder;
  private server: Server;
  private routes: Routes;
  private staticRoutes: StaticRoutes;
  private middlewares: MiddlewareFn[];
  private corsFn: MiddlewareFn;
  private serverOptions: BunnerServerOptions;

  constructor(options?: BunnerServerOptions) {
    super();

    this.apiDocumentBuilder = new ApiDocumentBuilder();
    this.middlewares = [];
    this.routes = new Map();
    this.staticRoutes = new Map();
    this.serverOptions = options || {};
  }

  /**
   * Get the address of the server
   * @returns The address of the server
   */
  address() {
    return this.server.url;
  }

  /**
   * Add a GET route
   * @param path - The path to add the route to
   * @param handler - The handler to call when the route is matched
   */
  get(path: string, handler: RouteHandler) {
    this.addRoute(HttpMethod.GET, path, handler);
  }

  /**
   * Add a POST route
   * @param path - The path to add the route to
   * @param handler - The handler to call when the route is matched
   */
  post(path: string, handler: RouteHandler) {
    this.addRoute(HttpMethod.POST, path, handler);
  }

  /**
   * Add a PUT route
   * @param path - The path to add the route to
   * @param handler - The handler to call when the route is matched
   */
  put(path: string, handler: RouteHandler) {
    this.addRoute(HttpMethod.PUT, path, handler);
  }

  /**
   * Add a DELETE route
   * @param path - The path to add the route to
   * @param handler - The handler to call when the route is matched
   */
  delete(path: string, handler: RouteHandler) {
    this.addRoute(HttpMethod.DELETE, path, handler);
  }

  /**
   * Add a PATCH route
   * @param path - The path to add the route to
   * @param handler - The handler to call when the route is matched
   */
  patch(path: string, handler: RouteHandler) {
    this.addRoute(HttpMethod.PATCH, path, handler);
  }

  /**
   * Add a OPTIONS route
   * @param path - The path to add the route to
   * @param handler - The handler to call when the route is matched
   */
  options(path: string, handler: RouteHandler) {
    this.addRoute(HttpMethod.OPTIONS, path, handler);
  }

  /**
   * Add a HEAD route
   * @param path - The path to add the route to
   * @param handler - The handler to call when the route is matched
   */
  head(path: string, handler: RouteHandler) {
    this.addRoute(HttpMethod.HEAD, path, handler);
  }

  /**
   * Add a middleware
   * @param middleware - The middleware to add
   */
  use(middleware: MiddlewareFn) {
    this.middlewares.push(middleware);
  }

  /**
   * Enable CORS middleware
   * @param options - The options for the CORS middleware
   */
  enableCors(options: CorsOptions) {
    this.corsFn = cors(options);

    this.use(this.corsFn);
  }

  /**
   * Listen for requests on the given port
   * @param port - The port to listen on
   * @param cb - The callback to call when the server is listening
   */
  async listen(hostname: string, port: number, cb?: (...args: any[]) => void) {
    const cbArgs: any = [];

    try {
      this.server = Bun.serve({
        hostname,
        port,
        routes: {
          ...this.toBunRoutes(),
          ...await this.toBunStaticRoutes(),
        },
        ...this.serverOptions,
      });
    } catch (e) {
      cbArgs.push(e);

      if (this.listeners('error').length > 0) {
        this.emit('error', e);
      } else {
        throw e;
      }
    }

    if (typeof cb === 'function') {
      cb(...cbArgs);
    }
  }

  /**
   * Close the server
   * @param force - Whether to force the server to close
   */
  async close(force: boolean = false) {
    if (!this.server) {
      return;
    }

    await this.server.stop(force);
    this.server.unref();
  }

  /**
   * Add a route
   * @param method - The HTTP method to add the route for
   * @param path - The path to add the route to
   * @param handler - The handler to call when the route is matched
   */
  private addRoute(method: HttpMethod, path: string, handler: RouteHandler) {
    let methods = this.routes.get(path);

    if (!methods) {
      methods = new Map();
      methods.set(method, handler);

      this.routes.set(path, methods);

      return;
    }

    if (methods.has(method)) {
      throw new Error(`Duplicate route detected: [${method}] ${path}`);
    }

    methods.set(method, handler);
  }

  /**
   * Add a static route
   * @param urlPath - The path to add the static route to
   * @param filePath - The file path to add the static route to
   * @param options - The options for the static route
   */
  async static(urlPath: string, filePath: string, options: StaticOptions = {}) {
    this.staticRoutes.set(urlPath, { filePath, ...options });
  }

  /**
   * Convert the routes to a format that can be used by Bun
   * @returns The routes in a format that can be used by Bun
   */
  private toBunRoutes() {
    const routes: Record<string, BunRouteValue> = {};

    this.routes.forEach((methods, path) => {
      const methodHandlers: Record<string, BunRouteHandler> = {};

      if (!!this.corsFn && !methods.has(HttpMethod.OPTIONS)) {
        this.addRoute(HttpMethod.OPTIONS, path, () => { });
      }

      methods.forEach((handler, method) => {
        methodHandlers[method] = async (bunReq: BunRequest, server: Server) => {
          const req = await BunnerRequest.fromBunRequest(bunReq, server);
          const res = new BunnerResponse();

          for (const middleware of this.middlewares) {
            const result = await new Promise<any>(async (resolve, reject) => {
              const r = await middleware(req, res, () => resolve(undefined)).catch(reject);

              resolve(r);
            });

            if (result instanceof Response) {
              return result;
            }
          }

          if (handler instanceof Response) {
            return handler;
          }

          const result = await handler(req, res);

          if (result instanceof Response) {
            res.setResponse(result);
          } else if (result !== undefined) {
            res.setBody(result);
          }

          return res.end();
        };
      });

      routes[path] = methodHandlers;
    });

    const notFound = new Response(ReasonPhrases.NOT_FOUND, { status: StatusCodes.NOT_FOUND });

    routes['/*'] = async (bunReq, server) => {
      const res = new BunnerResponse();

      if (this.corsFn) {
        const corsResult = await this.corsFn(bunReq, res, () => { });

        if (corsResult instanceof Response) {
          return corsResult;
        }
      }

      return notFound;
    };

    return routes;
  }

  /**
   * Convert the static routes to a format that can be used by Bun
   * @returns The static routes in a format that can be used by Bun
   */
  private toBunStaticRoutes() {
    const routes: Record<string, BunRouteValue> = {};
    const forbiddenResponse = new Response(ReasonPhrases.FORBIDDEN, { status: StatusCodes.FORBIDDEN });
    const makeHandler = (urlPath: string, config: StaticConfig): BunRouteHandler => {
      return async (bunReq: BunRequest) => {
        try {
          const parsed = new URL(bunReq.url);
          const path = parsed.pathname;
          const relativePath = path.replace(urlPath ?? '', '').replace(this.staticPathFilter, '');
          const file = Bun.file(config.filePath + '/' + relativePath);
          const stat = await file.stat();

          if (stat.isFile()) {
            return new Response(file);
          }

          if (config.index === false) {
            return forbiddenResponse;
          }

          const indexes = Array.isArray(config.index) ? config.index : [config.index ?? 'index.html'];

          for (const index of indexes) {
            try {
              const indexFile = Bun.file(config.filePath + '/' + relativePath + '/' + index);
              const indexStat = await indexFile.stat();

              if (indexStat.isFile()) {
                return new Response(indexFile);
              }
            } catch (e) {
              continue;
            }
          }

          return forbiddenResponse;
        } catch (e) {
          return new Response(ReasonPhrases.NOT_FOUND, { status: StatusCodes.NOT_FOUND });
        }
      };
    }

    for (const [urlPath, staticConfig] of Array.from(this.staticRoutes)) {
      const handler = makeHandler(urlPath, staticConfig);

      routes[urlPath] = { GET: handler };
      routes[urlPath.replace(/\/$/, '') + '/*'] = { GET: handler };
    }

    return routes;
  }

  /**
   * Enable API Document
   * @param path - The path to serve the API Document interface
   * @param value - The API description (URL, file path, or content)
   */
  async enableApiDocument(path: string, value: string, options?: ApiDocumentOptions) {
    const { useTemplate = true } = options || {};
    const { spec: text, parsedSpec, fileType } = await this.apiDocumentBuilder.build(value);
    const filteredPath = '/' + path.replace(this.staticPathFilter, '').replace(/\/$/, '');
    const specPath = `${filteredPath}/spec.${fileType}`;

    this.get(specPath, () => new Response(text, {
      headers: {
        [HeaderField.CONTENT_TYPE]: fileType === 'json' ? ContentType.JSON : ContentType.YAML,
        [HeaderField.CONTENT_LENGTH]: text.length.toString(),
      },
    }));

    if (!useTemplate) {
      return;
    }

    const template = await this.apiDocumentBuilder.getTemplate(parsedSpec, specPath);

    this.get(filteredPath, () => new Response(template, {
      headers: {
        [HeaderField.CONTENT_TYPE]: ContentType.HTML,
        [HeaderField.CONTENT_LENGTH]: template.length.toString(),
      },
    }));
  }
}
