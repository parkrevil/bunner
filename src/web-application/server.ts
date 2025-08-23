import type { Server } from 'bun';
import type { BunnerWebServerStartOptions } from './interfaces';

export class BunnerWebServer {
  private server: Server;

  constructor() { }

  /**
   * Start the server
   * @param options - The options for the server
   * @returns A promise that resolves to true if the server started successfully
   */
  start(options: BunnerWebServerStartOptions) {
    this.server = Bun.serve({
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
