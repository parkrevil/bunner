import type { Server } from 'bun';
import type { BunnerWebServerStartOptions } from './interfaces';
import { Router } from './router';

export class BunnerWebServer {
  private readonly router: Router;
  private server: Server;

  constructor() {
    this.router = new Router();
  }

  /**
   * Start the server
   * @param options - The options for the server
   * @returns A promise that resolves to true if the server started successfully
   */
  start(options: BunnerWebServerStartOptions) {
    this.server = Bun.serve({
      routes: this.router.getRoutes(),
      ...options,
    });
  }

  /**
   * Stop the server
   * @param force - Whether to force the server to close
   */
  async stop(force = false) {
    if (!this.server) {
      return;
    }

    force && this.server.unref();

    await this.server.stop(force);
  }
}
