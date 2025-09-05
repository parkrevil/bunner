import {
  BunnerApplication,
  type BunnerRootModule,
  type Class,
} from '@bunner/core';
import type { Server } from 'bun';

import { RustCore } from './rust-core';
import { type HttpMethodValue } from './types';

export class HttpServer extends BunnerApplication {
  private server: Server | undefined;
  private rustCore: RustCore;

  constructor(rootModule: Class<BunnerRootModule>) {
    super(rootModule);

    this.server = undefined;
    this.rustCore = new RustCore();
  }

  override async init() {
    await super.init();
    this.rustCore.init();
  }

  /**
   * Start the server
   */
  start() {
    this.rustCore.addRoute('GET', '/');
    this.rustCore.addRoute('GET', '/users');
    this.rustCore.addRoute('PUT', '/users/:id');
    this.rustCore.addRoute('DELETE', '/users/:id');
    this.rustCore.addRoute('PATCH', '/users/:id');
    this.rustCore.addRoute('OPTIONS', '/users/:id');
    this.rustCore.addRoute('HEAD', '/users/:id');
    this.rustCore.build();

    this.server = Bun.serve({
      port: 5000,
      fetch: req => {
        this.rustCore.handleRequest(req.method as HttpMethodValue, req.url);

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
