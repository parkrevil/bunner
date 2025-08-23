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
    console.log('start');
    this.server = Bun.serve({
      routes: {
        '/': {
          GET: (req, server) => {
            return new Response('Hello World');
          },
        },
      },
      fetch: (req, server) => {
        return new Response('Hello World');
      },
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
