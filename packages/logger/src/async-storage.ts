import { AsyncLocalStorage } from 'node:async_hooks';

export class RequestContext {
  private static storage = new AsyncLocalStorage<string>();

  static run<R>(reqId: string, callback: () => R): R {
    return this.storage.run(reqId, callback);
  }

  static getRequestId(): string | undefined {
    return this.storage.getStore();
  }
}