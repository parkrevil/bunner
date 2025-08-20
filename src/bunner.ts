import { BunRequest, Server } from 'bun';
import { EventEmitter } from "events";
import { ReasonPhrases, StatusCodes } from 'http-status-codes';
import { HttpMethod } from './enums';
import { cors, CorsOptions } from './middlewares/cors';
import { BunnerRequest } from './request';
import { BunnerResponse } from './response';
import { BunnerServerOptions, BunRouteHandler, BunRouteValue, MiddlewareFn, RouteHandler, Routes } from './types';

export class Bunner extends EventEmitter {
  private server: Server;
  private routes: Routes;
  private middlewares: MiddlewareFn[];
  private corsFn: MiddlewareFn;
  private serverOptions: BunnerServerOptions;

  constructor(options?: BunnerServerOptions) {
    super();

    this.middlewares = [];
    this.routes = new Map();
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

  cors(options: CorsOptions) {
    this.corsFn = cors(options);

    this.use(this.corsFn);
  }

  /**
   * Listen for requests on the given port
   * @param port - The port to listen on
   * @param cb - The callback to call when the server is listening
   */
  listen(hostname: string, port: number, cb?: () => void) {
    try {
      this.server = Bun.serve({
        hostname,
        port,
        routes: this.toBunRoutes(),
        ...this.serverOptions,
      });
    } catch (e) {
      this.emit('error', e);
    }

    if (cb) cb();
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

          const result = await handler(req, res);

          if (result instanceof Response) {
            res.setResponse(result);
          } else if (result !== undefined) {
            res.body = result;
          }

          return res.end();
        };
      });

      routes[path] = methodHandlers;
    });

    routes['/*'] = async (bunReq, server) => {
      const req = await BunnerRequest.fromBunRequest(bunReq, server);
      const res = new BunnerResponse();

      if (this.corsFn) {
        const corsResult = await this.corsFn(req, res, () => { });

        if (corsResult instanceof Response) {
          return corsResult;
        }
      }

      return new Response(ReasonPhrases.NOT_FOUND, { status: StatusCodes.NOT_FOUND });
    };

    return routes;
  }
}
