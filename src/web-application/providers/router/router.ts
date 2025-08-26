import findMyWay from 'find-my-way';
import qs from 'qs';
import { container } from '../../../core/injector';
import { HttpMethodDecorator, RestControllerDecorator } from '../../constants';
import type { HttpMethodDecoratorMetadata, RestControllerDecoratorMetadata } from '../../interfaces';
import type { HttpMethodType } from '../../types';
import type { RouteHandler } from './types';

export class Router {
  private readonly router: findMyWay.Instance<any>;

  constructor() {
    this.router = findMyWay({
      querystringParser: qs.parse,
      caseSensitive: true,
      ignoreTrailingSlash: true,
      ignoreDuplicateSlashes: true,
      allowUnsafeRegex: true,
    });
  }

  /**
   * Register routes
   */
  register() {
    const controllers = container.getControllers();

    controllers.forEach((controllerInstance, controllerConstructor) => {
      const controllerPrototype = Object.getPrototypeOf(controllerInstance);
      const {
        path: controllerPath = '',
        version: controllerVersion,
        document: controllerDocument,
      }: RestControllerDecoratorMetadata = Reflect.getMetadata(RestControllerDecorator, controllerConstructor) ?? {};

      Object.getOwnPropertyNames(controllerPrototype).forEach(handlerName => {
        if (handlerName === 'constructor' || typeof controllerPrototype[handlerName] !== 'function') {
          return;
        }

        const {
          httpMethod,
          httpStatus,
          version: methodVersion,
          path: methodPath,
          document: methodDocument,
        }: HttpMethodDecoratorMetadata = Reflect.getMetadata(HttpMethodDecorator, controllerPrototype, handlerName);

        if (!httpMethod) {
          return;
        }

        this.router.on(
          httpMethod,
          '/' + [
            methodVersion ?? controllerVersion ?? '',
            controllerPath ?? '',
            methodPath ?? '',
          ].join('/'),
          (req, res) => controllerInstance[handlerName](req, res),
        );
      });
    });
  }

  /**
   * Find a route
   * @param method - The method of the request
   * @param path - The path of the request
   * @returns The route
   */
  find(method: HttpMethodType, path: string) {
    const route = this.router.find(method, path);

    if (!route) {
      return;
    }

    const handler: RouteHandler = (req, res) => (route.handler as any)(req, res);

    return {
      handler,
      params: route.params,
      store: route.store,
      searchParams: route.searchParams,
    };
  }
}
