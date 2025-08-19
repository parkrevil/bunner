import { BunRequest } from 'bun';
import { HttpMethod } from './enums';
import { BunnerResponse } from './response';
import { BunRouteHandler, BunRouteHandlerObject, BunRouteValue, RouteHandler, Routes } from './types';

export class Router {
  private routes: Routes;

  constructor() {
    this.routes = new Map();
  }

  add(method: HttpMethod, path: string, handler: RouteHandler) {
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

  toBunRoutes(): Record<string, BunRouteValue> {
    const routes: Record<string, BunRouteValue> = {};

    this.routes.forEach((methods, path) => {
      const methodHandlers: Record<string, BunRouteHandler> = {};

      methods.forEach((handler, method) => {
        methodHandlers[method] = async (req: BunRequest) => {
          const res = new BunnerResponse();
          const result = await handler(req, res);

          if (result instanceof Response) {
            res.setResponse(result);
          } else if (result !== undefined) {
            res.body = result;
          }

          return res.end();
        };
      });

      routes[path] = methodHandlers as BunRouteHandlerObject;
    });

    return routes;
  }
}