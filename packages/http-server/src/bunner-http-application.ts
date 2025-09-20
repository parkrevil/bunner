import {
  BaseApplication,
  capitalize,
  LogLevel,
  WorkerPool,
  type RootModuleFile,
} from '@bunner/core';
import { Logger } from '@bunner/core-logger';
import type { Server } from 'bun';

import { HttpMethod } from './enums';
import { MethodNotAllowedError } from './errors';
import type { BunnerHttpServerOptions } from './interfaces';
import type { Worker } from './worker';

export class BunnerHttpServer extends BaseApplication<BunnerHttpServerOptions> {
  private readonly name: string;
  private readonly rootModuleFile: RootModuleFile;
  private readonly logger = new Logger();
  private server: Server | undefined;
  private workerPool: WorkerPool<Worker>;

  constructor(
    name: string,
    rootModuleFile: RootModuleFile,
    options: BunnerHttpServerOptions,
  ) {
    super();

    this.name = name;
    this.server = undefined;
    this.rootModuleFile = rootModuleFile;
    this.options = {
      logLevel: options.logLevel ?? LogLevel.Info,
    };
    this.workerPool = new WorkerPool<Worker>({
      script: new URL('./worker.ts', import.meta.url),
    });
  }

  /**
   * Initialize the server
   */
  async init() {
    await this.workerPool.init({
      appName: this.name,
      rootModuleFile: this.rootModuleFile,
      options: {
        ...this.options,
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
    if (!this.server) {
      return;
    }

    await this.server.stop(force);

    // TODO send destroy message to worker

    this.server = undefined;
  }
}
