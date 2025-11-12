import { type Container } from '@bunner/core';

import {
  MetadataKey,
  type RestControllerMetadata,
  type RestRouteHandlerMetadata,
  type RestRouteHandlerParamMetadata,
} from './decorators';
import { HttpMethod } from './enums';
import type { RouteHandlerEntry } from './interfaces';
import type { RouteKey } from './types';

export class RouteHandler {
  private container: Container;
  private handlers: Map<RouteKey, RouteHandlerEntry>;

  constructor(container: Container) {
    this.container = container;
  }

  /**
   * Collect routes from controllers and register them to the router
   */
  register() {
    const entries: RouteHandlerEntry[] = [];
    const addRoutesParams: [HttpMethod, string][] = [];

    this.container.getControllers<RestControllerMetadata>(MetadataKey.RestController).forEach(controller => {
      const { instance: controllerInstance, path: prefix, options: controllerOptions } = controller;
      const controllerProto = Object.getPrototypeOf(controllerInstance);

      Object.getOwnPropertyNames(controllerProto).forEach(handlerName => {
        if (handlerName === 'constructor' || typeof controllerProto[handlerName] !== 'function') {
          return;
        }

        const {
          httpMethod,
          path: routePath,
          options: routeOptions,
        }: RestRouteHandlerMetadata = Reflect.getMetadata(MetadataKey.RouteHandler, controllerProto, handlerName);

        if (httpMethod === undefined) {
          return;
        }

        const routeParams: RestRouteHandlerParamMetadata[] =
          Reflect.getMetadata(MetadataKey.RouteHandlerParams, controllerProto, handlerName) ?? [];
        const fullPath =
          '/' +
          [routeOptions?.version ?? controllerOptions?.version ?? '', prefix ?? '', routePath ?? ''].filter(Boolean).join('/');

        entries.push({
          handler: controllerInstance[handlerName].bind(controllerInstance),
          paramType: routeParams.sort((a, b) => a.index - b.index).map(p => p.type),
        });
        addRoutesParams.push([httpMethod, fullPath]);
      });
    });

    const addRoutesResult = this.ffi.addRoutes(addRoutesParams);

    this.handlers = new Map<RouteKey, RouteHandlerEntry>(addRoutesResult.map((routeKey, index) => [routeKey, entries[index]!]));
  }

  /**
   * Find a handler function by route key
   * @param key - The route key
   * @returns
   */
  find(key: RouteKey): RouteHandlerEntry | undefined {
    return this.handlers.get(key);
  }
}
