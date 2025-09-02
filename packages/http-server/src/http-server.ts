import {
  BunnerApplication,
  type BunnerRootModule,
  type Class,
} from '@bunner/core';
import type { Server } from 'bun';

export class HttpServer extends BunnerApplication {
  private server: Server | undefined;

  constructor(rootModule: Class<BunnerRootModule>) {
    super(rootModule);

    this.server = undefined;
  }

  /**
   * Start the server
   */
  start() {
    this.server = Bun.serve({
      port: 5000,
      fetch: req => {
        console.log(req.url);

        return new Response('Hello, world!');
      },
    });
  }

  /**
   * Stop the server
   * @param force - Whether to force the server to close
   * @returns A promise that resolves to true if the application stopped successfully
   */
  async stop(force = false) {
    if (!this.server) {
      return;
    }

    await this.server.stop(force);
  }
}
