import { BaseApplication, type BunnerApplicationNormalizedOptions, type EntryModuleMetadata } from '@bunner/core';

import { type BunnerHttpServerOptions } from './interfaces';
import { HttpRuntime } from './runtime';

export class BunnerHttpServer extends BaseApplication<BunnerHttpServerOptions> {
  // Static property for BaseApplication.createRuntime (Worker Context)
  static Runtime = HttpRuntime;

  constructor(entryModule: EntryModuleMetadata, options: BunnerApplicationNormalizedOptions) {
    const defaultOptions = {
      port: 5000,
      bodyLimit: 10 * 1024 * 1024,
      trustProxy: false,
    };
    super(entryModule, { ...defaultOptions, ...options });
  }

  // Used by BaseApplication (Instance Context - Single Process)
  protected async getRuntimeClass() {
    return await Promise.resolve(HttpRuntime);
  }

  // Used by BaseApplication (Instance Context - Cluster Process)
  protected getLibraryWorkerPath(): URL {
    const currentUrl = import.meta.url;
    const isBundled = currentUrl.endsWith('.js');
    return isBundled ? new URL('./bunner-http-worker.js', currentUrl) : new URL('./bunner-http-worker.ts', currentUrl);
  }
}
