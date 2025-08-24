import findMyWay from 'find-my-way';
import qs from 'qs';
import { container } from '../../core/injector';
import { HttpMethodDecorator, RestControllerDecorator } from '../constants';
import type { HttpMethodDecoratorMetadata, RestControllerDecoratorMetadata } from '../interfaces';
import type { BunnerRequest } from '../request';
import type { BunnerResponse } from '../response';
import type { HttpMethodType } from '../types';

export class Router {
  private readonly pathFilterRegexp = /^\/+|\/+$/g;
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
   * Build routes
   */
  build() {
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
          (req: BunnerRequest, res: BunnerResponse) => {
            console.log(req);
            return controllerInstance[handlerName]();
          }
        );
      });
    });
  }

  find(method: HttpMethodType, path: string) {
    return this.router.find(method, path);
  }

  /**
   * Build path
   * @param paths 
   * @returns 
   */
  private buildPath(...paths: string[]) {
    return '/' + paths
      .map(path => path.trim().replace(this.pathFilterRegexp, ''))
      .filter(Boolean)
      .join('/');
  }
}
