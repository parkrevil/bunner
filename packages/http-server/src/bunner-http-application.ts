import {
  BaseApplication,
  capitalize,
  WorkerPool,
  type BunnerApplicationNormalizedOptions,
  type RootModuleFile,
} from '@bunner/core';
import { Logger } from '@bunner/logger';
import type { Server } from 'bun';
import { StatusCodes } from 'http-status-codes';

import { BunnerHttpWorker } from './bunner-http-worker';
import { HttpMethod } from './enums';
import { MethodNotAllowedError } from './errors';
import { type BunnerHttpServerOptions } from './interfaces';
import { getIps } from './utils';

export class BunnerHttpServer extends BaseApplication<BunnerHttpServerOptions> {
  private readonly rootModuleFile: RootModuleFile;
  private server: Server<unknown> | undefined;
  private workerPool: WorkerPool<BunnerHttpWorker>;
  private readonly logger = new Logger(BunnerHttpServer.name);

  constructor(rootModuleFile: RootModuleFile, options: BunnerApplicationNormalizedOptions) {
    super();

    this.server = undefined;
    this.rootModuleFile = rootModuleFile;
    this.options = {
      ...{
        port: 5000,
        bodyLimit: 10 * 1024 * 1024, 
        trustProxy: false,
      },
      ...options,
    };

    const currentUrl = import.meta.url;
    const isBundled = currentUrl.endsWith('.js');
    const workerScript = isBundled
      ? new URL('./bunner-http-worker.js', currentUrl)
      : new URL('./bunner-http-worker.ts', currentUrl);

    this.workerPool = new WorkerPool<BunnerHttpWorker>({
      script: workerScript,
      size: options.workers,
    });
  }

  async init() {

    const sanitizedRootModuleFile: RootModuleFile = {
      path: this.rootModuleFile.path,
      className: this.rootModuleFile.className,
      manifestPath: this.rootModuleFile.manifestPath,

    };

    await this.workerPool.init({
      rootModuleFile: sanitizedRootModuleFile,
      options: {
        logLevel: this.options.logLevel,
        workers: this.options.workers,
        queueCapacity: this.options.queueCapacity,
      },
    });

    this.logger.info('✨ Bunner HTTP Server initialized');
  }

  async start() {
    await this.workerPool.bootstrap();

    this.server = Bun.serve({
      port: this.options.port,
      maxRequestBodySize: this.options.bodyLimit,
      fetch: async (req: Request) => {
        try {
          const normalizedHttpMethod = capitalize(req.method.toUpperCase()) as keyof typeof HttpMethod;
          const httpMethod = HttpMethod[normalizedHttpMethod];

          if (httpMethod === undefined) {
            throw new MethodNotAllowedError();
          }

          let body: string | undefined;

          if (
            httpMethod === HttpMethod.Get ||
            httpMethod === HttpMethod.Delete ||
            httpMethod === HttpMethod.Head ||
            httpMethod === HttpMethod.Options
          ) {
            body = undefined;
          } else {
            body = await req.text();
          }

          const { ip, ips } = getIps(req, this.server!, this.options.trustProxy);

          const workerRes = await this.workerPool.call('handleRequest', {
            httpMethod,
            url: req.url,
            headers: req.headers.toJSON(),
            body,
            request: {
              ip,
              ips,
              isTrustedProxy: this.options.trustProxy,
            },
          });

          if (!workerRes) {
            return new Response('Internal server error', {
              status: StatusCodes.INTERNAL_SERVER_ERROR,
            });
          }

          return new Response(workerRes.body, workerRes.init);
        } catch (e) {
          this.logger.error('Fetch Error', e);

          return new Response('Internal server error', {
            status: StatusCodes.INTERNAL_SERVER_ERROR,
          });
        }
      },
    });
  }

  async shutdown(force = false) {
    this.logger.info('🛑 HTTP Server is shutting down...');

    await this.workerPool.destroy();
    await this.server?.stop(force);
  }
}