import type { BunRequest, Server } from 'bun';
import { container } from '../../core/injector';
import { HttpMethodDecorator, RestControllerDecorator } from '../constants';
import type { HttpMethodDecoratorMetadata, RestControllerDecoratorMetadata } from '../interfaces';
import type { BunRoutes } from './types';

export class Router {
  private readonly pathFilterRegexp = /^\/+|\/+$/g;
  private readonly invalidPathCharsRegexp = /[ \t\n\r\f\v<>#?`{}\\[\]]/;
  private readonly invalidParamCharsRegexp = /[:?!]/;
  private routes: BunRoutes;

  constructor() {
    this.routes = {};
  }

  /**
   * Get routes
   * @returns 
   */
  getRoutes() {
    this.build();
    return this.routes;
  }

  /**
   * Build routes
   */
  build() {
    this.routes = {} as BunRoutes;

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

        const builtPath = this.buildPath(
          methodVersion ?? controllerVersion ?? '',
          controllerPath ?? '',
          methodPath ?? '',
        );

        if (!this.validatePath(builtPath)) {
          throw new Error(`Invalid path: ${builtPath}`);
        }

        if (!this.routes[builtPath]) {
          this.routes[builtPath] = {};
        } else if (this.routes[builtPath][httpMethod]) {
          throw new Error(`Route already exists: ${httpMethod} ${builtPath}`);
        }

        this.routes[builtPath][httpMethod] = async (bunReq: BunRequest, server: Server) => {
          const result = await controllerInstance[handlerName]();

          if (!result) {
            return new Response();
          }

          return new Response(JSON.stringify(result));
        };
      });
    });
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

  /**
   * Validate path
   * @param path 
   * @returns 
   */
  private validatePath(path: string): boolean {
    if (this.invalidPathCharsRegexp.test(path)) {
      return false;
    }

    if (path.includes('//') || path.includes('/./') || path.includes('/../')) {
      return false;
    }

    const segments = path.split('/').filter(Boolean);

    for (const segment of segments) {
      if (segment.startsWith(':')) {
        if (segment.length === 1) {
          return false;
        }

        if (this.invalidParamCharsRegexp.test(segment.substring(1))) {
          return false;
        }
      }
    }

    return true;
  }
}
