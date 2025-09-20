import {
  BaseApplication,
  LogLevel,
  WorkerPool,
  type RootModuleFile,
} from '@bunner/core';
import { Logger } from '@bunner/core-logger';
import type { Server } from 'bun';

import type { BunnerHttpServerOptions } from './interfaces';
import type { Worker } from './worker';

export class BunnerHttpServer extends BaseApplication<BunnerHttpServerOptions> {
  private readonly rootModuleFile: RootModuleFile;
  private readonly logger = new Logger();
  private server: Server | undefined;
  private workerPool: WorkerPool<Worker>;

  constructor(
    rootModuleFile: RootModuleFile,
    options?: BunnerHttpServerOptions,
  ) {
    super();

    this.server = undefined;
    this.rootModuleFile = rootModuleFile;
    this.options = {
      logLevel: options?.logLevel ?? LogLevel.Info,
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
      options: this.options,
      rootModuleFile: this.rootModuleFile,
    });

    this.logger.info('✨ Bunner HTTP Server initialized');
  }

  /**
   * Start the server
   */
  start() {
    this.server = Bun.serve({
      port: 5000,
      fetch: async () => {
        const res = await this.workerPool.worker.handleRequest();

        console.log(res);

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
