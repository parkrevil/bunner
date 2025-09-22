import {
  BaseApplication,
  capitalize,
  WorkerPool,
  type BunnerApplicationNormalizedOptions,
  type RootModuleFile,
} from '@bunner/core';
import { Logger } from '@bunner/core-logger';
import type { Server } from 'bun';

import { BunnerHttpWorker } from './bunner-http-worker';
import { HttpMethod } from './enums';
import { MethodNotAllowedError } from './errors';
import {
  type BunnerHttpServerOptions,
  type WorkerInitParams,
} from './interfaces';

export class BunnerHttpServer extends BaseApplication<BunnerHttpServerOptions> {
  private readonly rootModuleFile: RootModuleFile;
  private readonly logger = new Logger();
  private server: Server | undefined;
  private workerPool: WorkerPool<BunnerHttpWorker>;

  constructor(
    rootModuleFile: RootModuleFile,
    options: BunnerApplicationNormalizedOptions<BunnerHttpServer>,
  ) {
    super();

    this.server = undefined;
    this.rootModuleFile = rootModuleFile;
    this.options = options;
    this.options.port = this.options.port ?? 5000;
    this.workerPool = new WorkerPool<BunnerHttpWorker>({
      script: new URL('./bunner-http-worker.ts', import.meta.url),
      size: options.workers,
    });
  }

  /**
   * Initialize the server
   */
  async init() {
    await this.workerPool.init<WorkerInitParams>({
      rootModuleFile: this.rootModuleFile,
      options: {
        appName: this.options.name,
        logLevel: this.options.logLevel,
        workers: this.options.workers,
        queueCapacity: this.options.queueCapacity,
      },
    });

    this.logger.info('✨ Bunner HTTP Server initialized');
  }

  /**
   * Start the server
   */
  async start() {
    await this.workerPool.bootstrap();

    this.server = Bun.serve({
      port: 5000,
      fetch: async (req: Request) => {
        try {
          const httpMethod =
            HttpMethod[
              capitalize(req.method.toUpperCase()) as keyof typeof HttpMethod
            ];

          if (httpMethod === undefined) {
            throw new MethodNotAllowedError();
          }

          let body: ArrayBuffer | null;

          if (
            httpMethod === HttpMethod.Get ||
            httpMethod === HttpMethod.Head ||
            httpMethod === HttpMethod.Options
          ) {
            body = null;
          } else {
            body = await req.arrayBuffer();
          }

          await this.workerPool.worker.handleRequest({
            httpMethod,
            url: req.url,
            headers: req.headers.toJSON(),
            body,
          });

          return new Response('OK', { status: 200 });
        } catch (e) {
          this.logger.error(e);

          return new Response('Internal server error', { status: 500 });
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
