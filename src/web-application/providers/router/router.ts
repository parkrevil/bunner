import findMyWay from 'find-my-way';
import qs from 'qs';
import type { AppContainer } from '../../../core/injector';
import { HttpMethodDecorator, RestControllerDecorator } from '../../constants';
import type { HttpMethodDecoratorMetadata, RestControllerDecoratorMetadata } from '../../interfaces';
import type { HttpMethodType } from '../../types';
import type { RouteHandler } from './types';

export class Router {
  private readonly router: findMyWay.Instance<any>;
  private readonly appContainer: AppContainer;

  constructor(container: AppContainer) {
    this.appContainer = container;

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
    const controllerClasses = this.appContainer.getControllerClasses();

    controllerClasses.forEach((controllerConstructor) => {
      const controllerPrototype = controllerConstructor.prototype;
      const {
        path: controllerPath = '',
        version: controllerVersion,
        document: controllerDocument,
      }: RestControllerDecoratorMetadata = Reflect.getMetadata(RestControllerDecorator, controllerConstructor) ?? {};

      Object.getOwnPropertyNames(controllerPrototype).forEach(handlerName => {
        if (handlerName === 'constructor' || typeof controllerPrototype[handlerName] !== 'function') {
          return;
        }

        const httpMetadata: HttpMethodDecoratorMetadata = Reflect.getMetadata(HttpMethodDecorator, controllerPrototype, handlerName);

        if (!httpMetadata) {
          return;
        }

        const {
          httpMethod,
          version: methodVersion,
          path: methodPath,
        } = httpMetadata;

        this.router.on(
          httpMethod,
          '/' + [
            methodVersion ?? controllerVersion ?? '',
            controllerPath ?? '',
            methodPath ?? '',
          ].join('/'),
          (req, res) => {
            // Per-request container for Request scope
            const requestContainer = this.appContainer.createRequestContainer();

            const controller = requestContainer.get<any>(controllerConstructor);

            return controller[handlerName](req, res);
          },
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
