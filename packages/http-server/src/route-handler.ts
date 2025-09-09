import type { Container } from '@bunner/core';

import { HTTP_METHOD } from './constants';
import {
  METADATA_KEY,
  type RestControllerMetadata,
  type RestRouteHandlerMetadata,
} from './decorators';
import { RustCore } from './rust-core';
import type { HandlerFunction, HttpMethodValue } from './types';

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
    const handlers: HandlerFunction[] = [];
    const addRoutesParams: [HttpMethodValue, string][] = [];

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

          handlers.push(
            controllerInstance[handlerName].bind(controllerInstance),
          );
          addRoutesParams.push([httpMethod, fullPath]);
        });
      });

    const addRoutesResult = this.rustCore.addRoutes(addRoutesParams);

    this.handlers = new Map<number, HandlerFunction>(
      addRoutesResult.map((routeKey, index) => [routeKey, handlers[index]!]),
    );
  }

  /**
   * Handle the request
   * @param rawReq - The raw request object
   * @returns
   */
  async handleRequest(rawReq: Request) {
    if (!Object.hasOwn(HTTP_METHOD, rawReq.method)) {
      return new Response('Method not allowed', { status: 405 });
    }

    const httpMethod = HTTP_METHOD[rawReq.method as keyof typeof HTTP_METHOD];

    try {
      let body: string | null = null;

      if (
        !(
          httpMethod === HTTP_METHOD.GET ||
          httpMethod === HTTP_METHOD.HEAD ||
          httpMethod === HTTP_METHOD.OPTIONS
        )
      ) {
        body = await rawReq.text();
      }

      const handleResult = await this.rustCore.handleRequest({
        httpMethod,
        url: rawReq.url,
        headers: {},
        body,
      });
      const handler = this.handlers.get(handleResult.routeKey);

      if (!handler) {
        return new Response('Handler not found for route key', { status: 500 });
      }
      /* 
      const req = new BunnerRequest(rawReq, handleResult);
      const res = new BunnerResponse();
      const handlerResult = await handler(req, res);

      if (handlerResult instanceof Response) {
        return handlerResult;
      }

      if (res.isSent) {
        return res.getResponse();
      }
      res.send(handlerResult);
      return res.getResponse();
 */
      const result = await handler();

      return new Response(result, { status: 200 });
    } catch (e) {
      console.error(e, rawReq.method, rawReq.url);

      return new Response('Internal server error', { status: 500 });
    }
  }
}
