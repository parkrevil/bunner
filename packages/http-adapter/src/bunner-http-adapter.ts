import type { BunnerAdapter } from '@bunner/common';
import { ClusterManager, type ClusterBaseWorker, type BunnerApplicationNormalizedOptions } from '@bunner/core';

import { BunnerHttpServer } from './bunner-http-server';
import { type BunnerHttpMiddleware, type BunnerHttpServerOptions } from './interfaces';

export class BunnerHttpAdapter implements BunnerAdapter {
  private options: BunnerApplicationNormalizedOptions & BunnerHttpServerOptions;
  private clusterManager: ClusterManager<ClusterBaseWorker>;
  private httpServer: BunnerHttpServer | undefined;

  private middlewares = {
    beforeRequest: [] as BunnerHttpMiddleware[],
    afterRequest: [] as BunnerHttpMiddleware[],
    beforeHandler: [] as BunnerHttpMiddleware[],
    beforeResponse: [] as BunnerHttpMiddleware[],
    afterResponse: [] as BunnerHttpMiddleware[],
  };

  constructor(options: BunnerHttpServerOptions = {}) {
    this.options = {
      port: 5000,
      bodyLimit: 10 * 1024 * 1024,
      trustProxy: false,
      ...options,
      name: 'bunner-http',
      protocol: 'http',
      logLevel: 'debug',
    } as any;
  }

  public use(...middlewares: BunnerHttpMiddleware[]): this {
    this.middlewares.beforeRequest.push(...middlewares);
    return this;
  }

  public beforeRequest(...middlewares: BunnerHttpMiddleware[]): this {
    this.middlewares.beforeRequest.push(...middlewares);
    return this;
  }

  public afterRequest(...middlewares: BunnerHttpMiddleware[]): this {
    this.middlewares.afterRequest.push(...middlewares);
    return this;
  }

  public beforeHandler(...middlewares: BunnerHttpMiddleware[]): this {
    this.middlewares.beforeHandler.push(...middlewares);
    return this;
  }

  public beforeResponse(...middlewares: BunnerHttpMiddleware[]): this {
    this.middlewares.beforeResponse.push(...middlewares);
    return this;
  }

  public afterResponse(...middlewares: BunnerHttpMiddleware[]): this {
    this.middlewares.afterResponse.push(...middlewares);
    return this;
  }

  async start(context: any): Promise<void> {
    const workers = (this.options as any).workers;
    const isSingleProcess = !workers || workers === 1;

    if (isSingleProcess) {
      this.httpServer = new BunnerHttpServer();
      await this.httpServer.boot(context.container, {
        ...this.options,
        metadata: (globalThis as any).__BUNNER_METADATA_REGISTRY__,
        middlewares: this.middlewares,
      });
      return;
    }

    // === Multi Process Mode (Cluster) ===
    const entryModule = context.entryModule;

    if (!entryModule) {
      throw new Error('Entry Module not found in context. Cannot start Cluster Mode.');
    }

    const script = this.resolveWorkerScript();

    this.clusterManager = new ClusterManager<ClusterBaseWorker>({
      script,
      size: workers,
    });

    const sanitizedEntryModule = {
      path: 'unknown',
      className: entryModule.name,
    };

    await this.clusterManager.init({
      entryModule: sanitizedEntryModule as any,
      options: {
        ...this.options,
        middlewares: this.middlewares, // Pass middlewares to workers? 
        // Note: Middlewares are instances, cannot be passed to workers via serializable options easily if they have state.
        // For now, assuming they are re-instantiated or configuration-based in worker?
        // Actually, ClusterManager serializes options. Middlewares (being classes/functions) won't serialize well.
        // This is a limitation of Cluster mode without AOT/Code generation or re-configuration in worker.
        // But for "Named Adapter Access", the user configures adapters in `configure` method.
        // This `configure` runs in the Worker process too (since it runs App.init()).
        // So the worker will rebuild the adapter and re-configure middlewares!
        // So we DON'T strictly need to pass them here, as long as `configure` is deterministic.
        // However, `this.options` changes made here (like port) need to be passed.
      },
    });

    await this.clusterManager.bootstrap();
  }

  async stop(): Promise<void> {
    if (this.clusterManager) {
      await this.clusterManager.destroy();
    }
  }

  protected resolveWorkerScript(): URL {
    const hasAotManifest = !!(globalThis as any).__BUNNER_MANIFEST_PATH__;
    if (hasAotManifest) {
      return new URL('./bunner-http-worker.ts', import.meta.url);
    }
    return new URL(process.argv[1] || '', 'file://');
  }
}
