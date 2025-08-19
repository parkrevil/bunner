import { Server } from 'bun';
import { HttpMethod } from './enums';
import { Router } from './router';
import { RouteHandler } from './types';

export class Bunner {
  private router: Router;
  private server: Server;

  constructor() {
    this.router = new Router();
  }

  /**
   * Add a GET route
   * @param path - The path to add the route to
   * @param handler - The handler to call when the route is matched
   */
  get(path: string, handler: RouteHandler) {
    this.router.add(HttpMethod.GET, path, handler);
  }

  /**
   * Add a POST route
   * @param path - The path to add the route to
   * @param handler - The handler to call when the route is matched
   */
  post(path: string, handler: RouteHandler) {
    this.router.add(HttpMethod.POST, path, handler);
  }

  /**
   * Add a PUT route
   * @param path - The path to add the route to
   * @param handler - The handler to call when the route is matched
   */
  put(path: string, handler: RouteHandler) {
    this.router.add(HttpMethod.PUT, path, handler);
  }

  /**
   * Add a DELETE route
   * @param path - The path to add the route to
   * @param handler - The handler to call when the route is matched
   */
  delete(path: string, handler: RouteHandler) {
    this.router.add(HttpMethod.DELETE, path, handler);
  }

  /**
   * Add a PATCH route
   * @param path - The path to add the route to
   * @param handler - The handler to call when the route is matched
   */
  patch(path: string, handler: RouteHandler) {
    this.router.add(HttpMethod.PATCH, path, handler);
  }

  /**
   * Add a OPTIONS route
   * @param path - The path to add the route to
   * @param handler - The handler to call when the route is matched
   */
  options(path: string, handler: RouteHandler) {
    this.router.add(HttpMethod.OPTIONS, path, handler);
  }

  /**
   * Add a HEAD route
   * @param path - The path to add the route to
   * @param handler - The handler to call when the route is matched
   */
  head(path: string, handler: RouteHandler) {
    this.router.add(HttpMethod.HEAD, path, handler);
  }

  /**
   * Listen for requests on the given port
   * @param port - The port to listen on
   * @param cb - The callback to call when the server is listening
   */
  listen(port: number, cb?: () => void) {
    try {
      this.server = Bun.serve({
        port,
        routes: this.router.toBunRoutes(),
      });
    } catch (error) {
      console.error(error);
    }

    if (cb) cb();
  }

  /**
   * Close the server
   * @param force - Whether to force the server to close
   */
  async close(force: boolean = false) {
    if (!this.server) {
      return;
    }

    await this.server.stop(force);
    this.server.unref();
  }
}
