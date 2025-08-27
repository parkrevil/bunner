import findMyWay from 'find-my-way';
import qs from 'qs';
import type { AppContainer } from '../../../core/injector';
import { HttpMethodDecorator, RestControllerDecorator, type HttpMethodDecoratorMetadata, type RestControllerDecoratorMetadata } from '../../decorators';
import type { HttpMethodValue } from '../../types';
import { MiddlewareProvider, type PhaseMiddlewareMap } from '../middleware';
import type { RouteHandler } from './types';

export class RouterProvider {
  private readonly router: findMyWay.Instance<any>;
  private readonly appContainer: AppContainer;
  private readonly middlewareProvider: MiddlewareProvider;

  constructor(container: AppContainer, middlewareProvider: MiddlewareProvider) {
    this.router = findMyWay({
      querystringParser: qs.parse,
      caseSensitive: true,
      ignoreTrailingSlash: true,
      ignoreDuplicateSlashes: true,
      allowUnsafeRegex: true,
    });
    this.appContainer = container;
    this.middlewareProvider = middlewareProvider;
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
        middlewares: controllerMiddlewares = {},
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
          path: methodPath,
          version: methodVersion,
          middlewares: handlerMiddlewares = {},
        } = httpMetadata;
        const fullPath = '/' + [
          methodVersion ?? controllerVersion ?? '',
          controllerPath ?? '',
          methodPath ?? '',
        ].join('/');

        const handler = (req: any, res: any) => {
          const controller = this.appContainer.get<any>(controllerConstructor);

          return controller[handlerName](req, res);
        };

        const phaseMap: PhaseMiddlewareMap = {
          onRequest: [],
          beforeHandler: [],
          afterHandler: [],
          afterResponse: [],
        };

        const pre = this.middlewareProvider.precomputeForRoute(fullPath);

        if (pre.beforeHandler.length) phaseMap.beforeHandler.push(...pre.beforeHandler);
        if (controllerMiddlewares?.beforeHandler) phaseMap.beforeHandler.push(...controllerMiddlewares.beforeHandler);
        if (handlerMiddlewares?.beforeHandler) phaseMap.beforeHandler.push(...handlerMiddlewares.beforeHandler);

        if (pre.afterHandler.length) phaseMap.afterHandler.push(...pre.afterHandler);
        if (controllerMiddlewares?.afterHandler) phaseMap.afterHandler.push(...controllerMiddlewares.afterHandler);
        if (handlerMiddlewares?.afterHandler) phaseMap.afterHandler.push(...handlerMiddlewares.afterHandler);

        this.middlewareProvider.setPhaseMap(handler, phaseMap);

        this.router.on(
          httpMethod,
          fullPath,
          handler,
        );
      });
    });
  }

  /**
   * Find a route
   * @param httpMethod - The HTTP method of the request
   * @param path - The path of the request
   * @returns The route
   */
  find(httpMethod: HttpMethodValue, path: string) {
    const route = this.router.find(httpMethod, path);

    if (!route) {
      return;
    }

    const handler: RouteHandler = (req, res) => (route.handler as any)(req, res);

    return {
      handler,
      originalHandler: route.handler,
      params: route.params,
      searchParams: route.searchParams,
    };
  }
}
