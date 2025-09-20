import {
  BaseApplication,
  LogLevel,
  WorkerPool,
  type BaseModule,
  type Class,
} from '@bunner/core';
import { Logger } from '@bunner/core-logger';
import type { Server } from 'bun';

import type { BunnerHttpServerOptions } from './interfaces';

export class BunnerHttpServer extends BaseApplication<BunnerHttpServerOptions> {
  private readonly rootModule: Class<BaseModule>;
  private readonly logger = new Logger();
  private server: Server | undefined;
  private workerPool: WorkerPool;

  constructor(
    rootModule: Class<BaseModule>,
    options?: BunnerHttpServerOptions,
  ) {
    super();

    this.rootModule = rootModule;
    this.server = undefined;
    this.options = {
      logLevel: options?.logLevel ?? LogLevel.Info,
    };
    this.workerPool = new WorkerPool({
      script: new URL('./worker.ts', import.meta.url),
    });
  }

  /**
   * Initialize the server
   */
  async init() {
    //TODO init worker
  }

  /**
   * Start the server
   */
  start() {
    this.server = Bun.serve({
      port: 5000,
      fetch: () => {
        this.workerPool.exec({ ddd: 'ddd' });

        // this.onRequest.bind(this),
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
