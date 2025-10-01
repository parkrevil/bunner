import { type Container } from '@bunner/core';

import {
  MetadataKey,
  type RestControllerMetadata,
  type RestRouteHandlerMetadata,
} from './decorators';
import { HttpMethod } from './enums';
import { Ffi } from './ffi';
import type { HandlerFunction } from './types';

export class RouteHandler {
  private container: Container;
  private ffi: Ffi;
  private handlers: Map<number, HandlerFunction>;

  constructor(container: Container, ffi: Ffi) {
    this.container = container;
    this.ffi = ffi;
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
        const controllerProto = Object.getPrototypeOf(controllerInstance);

        Object.getOwnPropertyNames(controllerProto).forEach(handlerName => {
          if (
            handlerName === 'constructor' ||
            typeof controllerProto[handlerName] !== 'function'
          ) {
            return;
          }

          const {
            httpMethod,
            path: routePath,
            options: routeOptions,
          }: RestRouteHandlerMetadata = Reflect.getMetadata(
            MetadataKey.RouteHandler,
            controllerProto,
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

    const addRoutesResult = this.ffi.addRoutes(addRoutesParams);

    this.handlers = new Map<number, HandlerFunction>(
      addRoutesResult.map((routeKey, index) => [routeKey, handlers[index]!]),
    );
  }

  /**
   * Find a handler function by route key
   * @param key - The route key
   * @returns
   */
  find(key: number) {
    return this.handlers.get(key);
  }
}
