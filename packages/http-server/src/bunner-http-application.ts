import {
  BaseApplication,
  capitalize,
  WorkerPool,
  type BunnerApplicationNormalizedOptions,
  type RootModuleFile,
} from '@bunner/core';
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

  constructor(rootModuleFile: RootModuleFile, options: BunnerApplicationNormalizedOptions) {
    super();

    this.server = undefined;
    this.rootModuleFile = rootModuleFile;
    this.options = {
      ...{
        port: 5000,
        bodyLimit: 10 * 1024 * 1024, // 10 MB
        trustProxy: false,
      },
      ...options,
    };
    this.workerPool = new WorkerPool<BunnerHttpWorker>({
      script: new URL('./bunner-http-worker.ts', import.meta.url),
      size: options.workers,
    });
  }

  /**
   * Initialize the server
   */
  async init() {
    await this.workerPool.init({
      rootModuleFile: this.rootModuleFile,
      options: {
        logLevel: this.options.logLevel,
        workers: this.options.workers,
        queueCapacity: this.options.queueCapacity,
      },
    });

    console.info('✨ Bunner HTTP Server initialized');
  }

  /**
   * Start the server
   */
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
          console.error(e);

          return new Response('Internal server error', {
            status: StatusCodes.INTERNAL_SERVER_ERROR,
          });
        }
      },
    });
  }

  /**
   * Stop and destroy the server
   * @param force - Whether to force the server to close
   * @returns A promise that resolves to true if the application stopped successfully
   */
  async shutdown(force = false) {
    console.log('🛑 HTTP Server is shutting down...');

    await this.workerPool.destroy();
    await this.server?.stop(force);
  }
}
