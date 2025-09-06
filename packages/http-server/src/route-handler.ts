import type { Container } from '@bunner/core';

import { HTTP_METHOD } from './constants';
import {
  METADATA_KEY,
  type RestControllerMetadata,
  type RestRouteHandlerMetadata,
} from './decorators';
import { RustCore } from './rust-core';
import type { HandlerFunction } from './types';

export class RouteHandler {
  private container: Container;
  private rustCore: RustCore;
  private handlers: Map<number, HandlerFunction>;

  constructor(container: Container, rustCore: RustCore) {
    this.container = container;
    this.rustCore = rustCore;
    this.handlers = new Map<number, HandlerFunction>();
  }

  /**
   * Collect routes from controllers and register them to the router
   */
  register() {
    this.container
      .getControllers<RestControllerMetadata>(METADATA_KEY.REST_CONTROLLER)
      .forEach(controller => {
        const {
          instance: controllerInstance,
          path: controllerPath,
          options: controllerOptions,
        } = controller;
        const controllerPrototype = Object.getPrototypeOf(controllerInstance);

        Object.getOwnPropertyNames(controllerPrototype).forEach(handlerName => {
          if (
            handlerName === 'constructor' ||
            typeof controllerPrototype[handlerName] !== 'function'
          ) {
            return;
          }

          const {
            httpMethod,
            path: routePath,
            options: routeOptions,
          }: RestRouteHandlerMetadata = Reflect.getMetadata(
            METADATA_KEY.ROUTE_HANDLER,
            controllerPrototype,
            handlerName,
          );
          const fullPath =
            '/' +
            [
              routeOptions?.version ?? controllerOptions?.version ?? '',
              controllerPath ?? '',
              routePath ?? '',
            ]
              .filter(Boolean)
              .join('/');

          try {
            const routeKey = this.rustCore.addRoute(httpMethod, fullPath);

            this.handlers.set(routeKey, controllerInstance[handlerName]);
          } catch (e) {
            console.error(e, httpMethod, fullPath);

            throw e;
          }
        });
      });
  }

  /**
   * Handle the request
   * @param req - The request object
   * @returns
   */
  handleRequest(req: Request) {
    if (!Object.hasOwn(HTTP_METHOD, req.method)) {
      return new Response('Method not allowed', { status: 405 });
    }

    const httpMethod = HTTP_METHOD[req.method as keyof typeof HTTP_METHOD];
    const url = new URL(req.url);

    try {
      const routeKey = this.rustCore.handleRequest(httpMethod, url.pathname);
      const handler = this.handlers.get(routeKey);

      if (!handler) {
        return new Response('Not found', { status: 500 });
      }

      return handler();
    } catch (e) {
      console.error(e, httpMethod, url.pathname);

      return new Response('Internal server error', { status: 500 });
    }
  }
}
