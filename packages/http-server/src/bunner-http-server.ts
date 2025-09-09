import {
  BunnerApplication,
  type BunnerRootModule,
  type Class,
} from '@bunner/core';
import type { Server } from 'bun';

import { RouteHandler } from './route-handler';
import { RustCore } from './rust-core';

export class BunnerHttpServer extends BunnerApplication {
  private server: Server | undefined;
  private rustCore: RustCore;
  private router: RouteHandler;

  constructor(rootModule: Class<BunnerRootModule>) {
    super(rootModule);

    this.server = undefined;
    this.rustCore = new RustCore();
    this.router = new RouteHandler(this.container, this.rustCore);
  }

  /**
   * Initialize the server
   */
  override async init() {
    await super.init();
    this.router.register();
  }

  /**
   * Start the server
   */
  start() {
    this.rustCore.finalizeRoutes();

    this.server = Bun.serve({
      port: 5000,
      fetch: req => this.router.handleRequest(req),
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
