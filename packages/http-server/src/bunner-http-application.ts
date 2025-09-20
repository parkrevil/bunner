import {
  BaseApplication,
  createWorkerPool,
  LogLevel,
  type BaseModule,
  type Class,
  type ComlinkWorkerPool,
} from '@bunner/core';
import { Logger } from '@bunner/core-logger';
import type { Server } from 'bun';

import type { BunnerHttpServerOptions } from './interfaces';
import type { Worker } from './worker';

export class BunnerHttpServer extends BaseApplication<BunnerHttpServerOptions> {
  private readonly logger = new Logger();
  private server: Server | undefined;
  private workerPool: ComlinkWorkerPool<Worker>;

  constructor(
    rootModule: Class<BaseModule>,
    options?: BunnerHttpServerOptions,
  ) {
    super();

    this.server = undefined;
    this.options = {
      logLevel: options?.logLevel ?? LogLevel.Info,
    };
    this.workerPool = createWorkerPool<Worker>({
      script: new URL('./worker.ts', import.meta.url),
    });

    this.workerPool.construct({
      options: this.options,
      //      rootModuleGetter: () => rootModule,
    });
  }

  /**
   * Initialize the server
   */
  init() {
    //this.workerPool.init();

    this.logger.info('✨ Bunner HTTP Server initialized');
  }

  /**
   * Start the server
   */
  start() {
    this.server = Bun.serve({
      port: 5000,
      fetch: () => {
        this.workerPool.handleRequest();

        return new Response('Not implemented', { status: 501 });
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
