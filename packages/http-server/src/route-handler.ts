import { capitalize, type Container } from '@bunner/core';
import type { Server } from 'bun';

import { BunnerRequest } from './bunner-request';
import { BunnerResponse } from './bunner-response';
import {
  MetadataKey,
  type RestControllerMetadata,
  type RestRouteHandlerMetadata,
} from './decorators';
import { HttpMethod } from './enums';
import { MethodNotAllowedError, NotFoundError } from './errors';
import type { FindHandlerResult } from './interfaces';
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
    const handlers: HandlerFunction[] = [];
    const addRoutesParams: [HttpMethod, string][] = [];

    this.container
      .getControllers<RestControllerMetadata>(MetadataKey.RestController)
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
            MetadataKey.RouteHandler,
            controllerPrototype,
            handlerName,
          );
          const fullPath = [
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
  async findHandler(rawReq: Request, server: Server) {
    const httpMethod =
      HttpMethod[
        capitalize(rawReq.method.toUpperCase()) as keyof typeof HttpMethod
      ];

    if (httpMethod === undefined) {
      throw new MethodNotAllowedError();
    }

    let body: string | null;

    if (
      httpMethod === HttpMethod.Get ||
      httpMethod === HttpMethod.Head ||
      httpMethod === HttpMethod.Options
    ) {
      body = null;
    } else {
      body = await rawReq.text();
    }

    const handleResult = await this.rustCore.handleRequest({
      httpMethod,
      url: rawReq.url,
      headers: rawReq.headers.toJSON(),
      body,
    });

    // want to GC
    body = null;

    const handler = this.handlers.get(handleResult.routeKey);

    if (!handler) {
      throw new NotFoundError();
    }

    const request = new BunnerRequest(handleResult.request, rawReq, server);
    const response = new BunnerResponse(request);
    const result: FindHandlerResult = {
      handler,
      request,
      response,
    };

    return result;
  }
}
