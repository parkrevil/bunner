import type { Server } from 'bun';
import { type BunnerWebServerStartOptions, type HttpMethodType } from '.';
import { BunnerApplication } from '../bunner-application';
import { BodyParser } from './providers/body-parser';
import { Router } from './providers/router';
import { BunnerRequest } from './request';
import { BunnerResponse } from './response';

export class BunnerWebApplication extends BunnerApplication {
  private readonly router: Router;
  private readonly bodyParser: BodyParser;
  private server: Server;

  constructor() {
    super();

    this.router = new Router(this.container);
    this.bodyParser = new BodyParser();
  }

  /**
   * Start the web application
   * @param options - The options for the web application
   * @returns A promise that resolves to true if the application started successfully
   */
  async start(options: BunnerWebServerStartOptions) {
    this.router.register();
    this.server = Bun.serve({
      fetch: async (rawReq: Request, server: Server) => {
        const route = this.router.find(rawReq.method as HttpMethodType, rawReq.url);

        if (!route) {
          return new Response('Not Found', { status: 404 });
        }

        const req = new BunnerRequest({
          request: rawReq,
          server,
          params: route.params,
          queryParams: route.searchParams,
        });
        const res = new BunnerResponse();

        req.body = await this.bodyParser.parse(req);

        const result = await route.handler(req, res);

        return new Response(result);
      },
      ...options,
    });
  }

  /**
   * Stop the server
   * @param force - Whether to force the server to close
   * @returns A promise that resolves to true if the application stopped successfully
   */
  async shutdown(force = false) {
    if (!this.server) {
      return;
    }

    force && this.server.unref();

    await this.server.stop(force);
  }
  /* 
    use(middleware: MiddlewareFn) {
      this.middlewares.push(middleware);
    }
  
    enableCors(options: CorsOptions) {
      this.corsFn = cors(options);
  
      this.use(this.corsFn);
    }
  
    private addRoute(method: HttpMethodType, path: string, handler: RouteHandler) {
      let methods = this.routes.get(path);
  
      if (!methods) {
        methods = new Map();
        methods.set(method, handler);
  
        this.routes.set(path, methods);
  
        return;
      }
  
      if (methods.has(method)) {
        throw new Error(`Duplicate route detected: [${method}] ${path}`);
      }
  
      methods.set(method, handler);
    }
  
    async static(urlPath: string, filePath: string, options: StaticOptions = {}) {
      this.staticRoutes.set(urlPath, { filePath, ...options });
    }
  
    private toBunRoutes() {
      const routes: Record<string, BunRouteValue> = {};
  
      this.routes.forEach((methods, path) => {
        const methodHandlers: Record<string, BunRouteHandler> = {};
  
        if (!!this.corsFn && !methods.has(HttpMethod.Options)) {
          this.addRoute(HttpMethod.Options, path, () => { });
        }
  
        methods.forEach((handler, method) => {
          methodHandlers[method] = async (bunReq: BunRequest, server: Server) => {
            const req = await BunnerRequest.fromBunRequest(bunReq, server);
            const res = new BunnerResponse();
  
            for (const middleware of this.middlewares) {
              const result = await new Promise<any>(async (resolve, reject) => {
                const r = await middleware(req, res, () => resolve(undefined)).catch(reject);
  
                resolve(r);
              });
  
              if (result instanceof Response) {
                return result;
              }
            }
  
            if (handler instanceof Response) {
              return handler;
            }
  
            const result = await handler(req, res);
  
            if (result instanceof Response) {
              res.setResponse(result);
            } else if (result !== undefined) {
              res.setBody(result);
            }
  
            return res.end();
          };
        });
  
        routes[path] = methodHandlers;
      });
  
      const notFound = new Response(ReasonPhrases.NOT_FOUND, { status: StatusCodes.NOT_FOUND });
  
      routes['/*'] = async (bunReq, server) => {
        const res = new BunnerResponse();
  
        if (this.corsFn) {
          const corsResult = await this.corsFn(bunReq, res, () => { });
  
          if (corsResult instanceof Response) {
            return corsResult;
          }
        }
  
        return notFound;
      };
  
      return routes;
    }
  
    private toBunStaticRoutes() {
      const routes: Record<string, BunRouteValue> = {};
      const forbiddenResponse = new Response(ReasonPhrases.FORBIDDEN, { status: StatusCodes.FORBIDDEN });
      const makeHandler = (urlPath: string, config: StaticConfig): BunRouteHandler => {
        return async (bunReq: BunRequest) => {
          try {
            const parsed = new URL(bunReq.url);
            const path = parsed.pathname;
            const relativePath = path.replace(urlPath ?? '', '').replace(this.staticPathFilter, '');
            const file = Bun.file(config.filePath + '/' + relativePath);
            const stat = await file.stat();
  
            if (stat.isFile()) {
              return new Response(file);
            }
  
            if (config.index === false) {
              return forbiddenResponse;
            }
  
            const indexes = Array.isArray(config.index) ? config.index : [config.index ?? 'index.html'];
  
            for (const index of indexes) {
              try {
                const indexFile = Bun.file(config.filePath + '/' + relativePath + '/' + index);
                const indexStat = await indexFile.stat();
  
                if (indexStat.isFile()) {
                  return new Response(indexFile);
                }
              } catch (e) {
                continue;
              }
            }
  
            return forbiddenResponse;
          } catch (e) {
            return new Response(ReasonPhrases.NOT_FOUND, { status: StatusCodes.NOT_FOUND });
          }
        };
      }
  
      for (const [urlPath, staticConfig] of Array.from(this.staticRoutes)) {
        const handler = makeHandler(urlPath, staticConfig);
  
        routes[urlPath] = { GET: handler };
        routes[urlPath.replace(/\/$/, '') + '/*'] = { GET: handler };
      }
  
      return routes;
    }
  
    async enableApiDocument(path: string, value: string, options?: ApiDocumentOptions) {
      const { useTemplate = true } = options || {};
      const { spec: text, parsedSpec, fileType } = await this.apiDocumentBuilder.build(value);
      const filteredPath = '/' + path.replace(this.staticPathFilter, '').replace(/\/$/, '');
      const specPath = `${filteredPath}/spec.${fileType}`;
  
      this.get(specPath, () => new Response(text, {
        headers: {
          [HeaderField.CONTENT_TYPE]: fileType === 'json' ? ContentType.JSON : ContentType.YAML,
          [HeaderField.CONTENT_LENGTH]: text.length.toString(),
        },
      }));
  
      if (!useTemplate) {
        return;
      }
  
      const template = await this.apiDocumentBuilder.getTemplate(parsedSpec, specPath);
  
      this.get(filteredPath, () => new Response(template, {
        headers: {
          [HeaderField.CONTENT_TYPE]: ContentType.HTML,
          [HeaderField.CONTENT_LENGTH]: template.length.toString(),
        },
      }));
    } */
}
