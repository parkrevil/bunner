import { type BunnerContainer, type BunnerMiddleware, type ErrorHandler } from '@bunner/common';
import { Logger } from '@bunner/logger';

import type { BunnerRequest } from './bunner-request';
import type { BunnerResponse } from './bunner-response';
import type { RouteHandlerEntry } from './interfaces';
import { ValidationPipe } from './pipes/validation.pipe';
import { Router } from './router';
import type { HttpMethod } from './types';

export interface MatchResult {
  entry: RouteHandlerEntry;
  params: Record<string, string>;
}

export class RouteHandler {
  private container: BunnerContainer;
  private metadataRegistry: Map<any, any>;
  private scopedKeys: Map<any, string>;
  private router = new Router<MatchResult>({
    ignoreTrailingSlash: true,
    enableCache: true,
  });
  private readonly logger = new Logger(RouteHandler.name);
  private validationPipe = new ValidationPipe();

  constructor(container: BunnerContainer, metadataRegistry: Map<any, any>, scopedKeys: Map<any, string> = new Map()) {
    this.container = container;
    this.metadataRegistry = metadataRegistry;
    this.scopedKeys = scopedKeys;
  }

  match(method: string, path: string): MatchResult | undefined {
    return this.router.match(method.toUpperCase() as HttpMethod, path) || undefined;
  }

  register() {
    this.logger.debug('🔍 Registering routes from metadata...');
    for (const [targetClass, meta] of this.metadataRegistry.entries()) {
      const controllerDec = (meta.decorators || []).find((d: any) => d.name === 'Controller' || d.name === 'RestController');

      if (controllerDec) {
        this.logger.debug(`FOUND Controller: ${meta.className}`);
        this.registerController(targetClass, meta, controllerDec);
      }
    }
  }

  /**
   * Undocumented/internal route registration channel.
   * This is intentionally untyped at the package boundary.
   */
  registerInternalRoutes(
    routes: ReadonlyArray<{ readonly method: string; readonly path: string; readonly handler: (...args: unknown[]) => unknown }>,
  ): void {
    for (const route of routes) {
      const method = String(route.method || '').toUpperCase();

      if (method !== 'GET') {
        continue;
      }

      const fullPath = route.path.startsWith('/') ? route.path : `/${route.path}`;

      const entry: RouteHandlerEntry = {
        handler: route.handler,
        paramType: [],
        paramRefs: [],
        controllerClass: null,
        methodName: '__internal__',
        middlewares: [],
        errorHandlers: [],
        paramFactory: (req: BunnerRequest, res: BunnerResponse) => {
          const arity = typeof route.handler === 'function' ? route.handler.length : 0;
          const args = arity >= 2 ? [req, res] : [req];

          return Promise.resolve(args as unknown as any[]);
        },
      };

      this.router.add(method as HttpMethod, fullPath, params => ({
        entry,
        params: params as Record<string, string>,
      }));

      this.logger.info(`🛣️  Internal Route Registered: [${method}] ${fullPath}`);
    }
  }

  private registerController(targetClass: any, meta: any, controllerDec: any) {
    const prefix = controllerDec.arguments[0] || '';

    const scopedKey = this.scopedKeys.get(targetClass);
    let instance;

    try {
      if (scopedKey) {
        instance = this.container.get(scopedKey);
      } else {
        instance = this.container.get(targetClass);
      }
    } catch {
      instance = undefined;
    }

    if (!instance) {
      this.logger.warn(`⚠️  Cannot resolve controller instance: ${meta.className} (Key: ${scopedKey || targetClass.name})`);
      return;
    }

    (meta.methods || []).forEach((method: any) => {
      const routeDec = (method.decorators || []).find((d: any) =>
        ['Get', 'Post', 'Put', 'Delete', 'Patch', 'Options', 'Head'].includes(d.name),
      );

      if (routeDec) {
        const httpMethod = routeDec.name.toUpperCase();
        const subPath = routeDec.arguments[0] || '';
        const fullPath = '/' + [prefix, subPath].filter(Boolean).join('/').replace(/\/+/g, '/');

        const paramTypes = (method.parameters || [])
          .sort((a: any, b: any) => a.index - b.index)
          .map((p: any) => {
            const d = (p.decorators || [])[0];
            return d ? d.name.toLowerCase() : 'unknown';
          });

        const paramRefs = (method.parameters || [])
          .sort((a: any, b: any) => a.index - b.index)
          .map((p: any) => this.resolveParamType(p.type));

        // Detect parameters early (moved into paramFactory closure)
        const paramsConfig = (method.parameters || []).map((p: any, i: number) => {
          const d = (p.decorators || [])[0];
          return {
            type: d ? d.name.toLowerCase() : undefined,
            name: p.name,
            metatype: this.resolveParamType(p.type),
            index: i,
          };
        });

        const paramFactory = async (req: BunnerRequest, res: BunnerResponse): Promise<any[]> => {
          const params = [];
          for (const config of paramsConfig) {
            let paramValue = undefined;
            const { type, metatype } = config;

            let typeToUse = type;

            // Fallback to name-based detection if no decorator
            if (!typeToUse && config.name) {
              const nameLower = config.name.toLowerCase();
              if (nameLower === 'params' || nameLower === 'param') {
                typeToUse = 'param';
              } else if (nameLower === 'body') {
                typeToUse = 'body';
              } else if (nameLower === 'query' || nameLower === 'queries') {
                typeToUse = 'query';
              } else if (nameLower === 'headers' || nameLower === 'header') {
                typeToUse = 'header';
              } else if (nameLower === 'req' || nameLower === 'request') {
                typeToUse = 'req';
              } else if (nameLower === 'res' || nameLower === 'response') {
                typeToUse = 'res';
              }
            }

            switch (typeToUse) {
              case 'body':
                paramValue = req.body;
                break;
              case 'param':
              case 'params':
                paramValue = req.params;
                break;
              case 'query':
              case 'queries':
                paramValue = req.query;
                break;
              case 'header':
              case 'headers':
                paramValue = req.headers;
                break;
              case 'cookie':
              case 'cookies':
                paramValue = req.cookies;
                break;
              case 'request':
              case 'req':
                paramValue = req;
                break;
              case 'response':
              case 'res':
                paramValue = res;
                break;
              case 'ip':
                paramValue = req.ip;
                break;
              default:
                paramValue = undefined;
                break;
            }

            if (metatype && (type === 'body' || type === 'query')) {
              paramValue = await this.validationPipe.transform(paramValue, {
                type: type,
                metatype,
                data: undefined,
              });
            }
            params.push(paramValue);
          }
          return params;
        };

        const middlewares = this.resolveMiddlewares(targetClass, method, meta);
        const errorHandlers = this.resolveErrorHandlers(targetClass, method, meta);

        const entry: RouteHandlerEntry = {
          handler: instance[method.name].bind(instance),
          paramType: paramTypes,
          paramRefs,
          controllerClass: targetClass,
          methodName: method.name,
          middlewares,
          errorHandlers,
          paramFactory,
        };

        this.router.add(httpMethod as HttpMethod, fullPath, params => ({
          entry,
          params: params as Record<string, string>,
        }));

        this.logger.info(`🛣️  Route Registered: [${httpMethod}] ${fullPath} -> ${targetClass.name}.${method.name}`);
      }
    });
  }

  private resolveMiddlewares(_targetClass: any, method: any, classMeta: any): BunnerMiddleware[] {
    const middlewares: BunnerMiddleware[] = [];

    // Method Level
    const decs = (method.decorators || []).filter((d: any) => d.name === 'UseMiddlewares');
    decs.forEach((d: any) => {
      (d.arguments || []).forEach((arg: any) => {
        try {
          const mw = this.container.get(arg);
          if (mw) {
            middlewares.push(mw);
          }
        } catch {}
      });
    });

    // Controller Level
    if (classMeta) {
      const decs = classMeta.decorators.filter((d: any) => d.name === 'UseMiddlewares');
      decs.forEach((d: any) => {
        (d.arguments || []).forEach((arg: any) => {
          try {
            const mw = this.container.get(arg);
            if (mw) {
              middlewares.push(mw);
            }
          } catch {}
        });
      });
    }

    return middlewares;
  }

  private resolveErrorHandlers(_targetClass: any, method: any, classMeta: any): ErrorHandler[] {
    const handlers: ErrorHandler[] = [];

    // Method handlers
    const methodDecs = method.decorators.filter((d: any) => d.name === 'UseErrorHandlers');
    methodDecs.forEach((d: any) =>
      (d.arguments || []).forEach((arg: any) => {
        try {
          const h = this.container.get(arg);
          if (h) {
            handlers.push(h);
          }
        } catch {}
      }),
    );

    // Controller handlers
    if (classMeta) {
      const decs = classMeta.decorators.filter((d: any) => d.name === 'UseErrorHandlers');
      decs.forEach((d: any) =>
        (d.arguments || []).forEach((arg: any) => {
          try {
            const h = this.container.get(arg);
            if (h) {
              handlers.push(h);
            }
          } catch {}
        }),
      );
    }

    return handlers;
  }

  private resolveParamType(type: any): any {
    if (typeof type !== 'string') {
      return type;
    }

    // Primitives
    if (['string', 'number', 'boolean', 'any', 'object', 'array'].includes(type.toLowerCase())) {
      return type;
    }

    // Lookup in registry
    for (const [ctor, meta] of this.metadataRegistry.entries()) {
      if (meta.className === type) {
        return ctor;
      }
    }

    return type;
  }
}
