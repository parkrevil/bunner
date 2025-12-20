import { AsyncLocalStorage } from 'node:async_hooks';

export class RequestContext {
  private static storage = new AsyncLocalStorage<string>();

  /**
   * Run a callback within a request context.
   * @param reqId The request ID to associate with the current context.
   * @param callback The callback to run.
   */
  static run<R>(reqId: string, callback: () => R): R {
    return this.storage.run(reqId, callback);
  }

  /**
   * Get the current request ID.
   */
  static getRequestId(): string | undefined {
    return this.storage.getStore();
  }
}
