import type { BunnerAdapter, ErrorFilterToken } from '@bunner/common';

import { ClusterManager, getRuntimeContext, type ClusterBaseWorker, type BunnerApplicationNormalizedOptions } from '@bunner/core';

import { BunnerHttpServer } from './bunner-http-server';
import {
  BunnerHttpInternalHost,
  HttpAdapterStartContext,
  HttpMiddlewareLifecycle,
  type BunnerHttpServerOptions,
  type HttpMiddlewareRegistry,
  type InternalRouteEntry,
  type MiddlewareRegistrationInput,
} from './interfaces';

const BUNNER_HTTP_INTERNAL = Symbol.for('bunner:http:internal');

export class BunnerHttpAdapter implements BunnerAdapter {
  private options: BunnerApplicationNormalizedOptions & BunnerHttpServerOptions;
  private clusterManager: ClusterManager<ClusterBaseWorker>;
  private httpServer: BunnerHttpServer | undefined;

  private internalRoutes: InternalRouteEntry[] = [];

  private middlewareRegistry: HttpMiddlewareRegistry = {};

  private errorFilterTokens: ErrorFilterToken[] = [];

  constructor(options: BunnerHttpServerOptions = {}) {
    this.options = {
      port: 5000,
      bodyLimit: 10 * 1024 * 1024,
      trustProxy: false,
      ...options,
      name: 'bunner-http',
      protocol: 'http',
      logLevel: 'debug',
    } as BunnerApplicationNormalizedOptions & BunnerHttpServerOptions;

    const internalHost = this as BunnerHttpInternalHost;

    internalHost[BUNNER_HTTP_INTERNAL] = {
      get: (path: string, handler: InternalRouteHandler) => {
        this.internalRoutes.push({ method: 'GET', path, handler });
      },
    };
  }

  public addMiddlewares(lifecycle: HttpMiddlewareLifecycle, middlewares: readonly MiddlewareRegistrationInput[]): this {
    this.middlewareRegistry[lifecycle] ??= [];

    const current = this.middlewareRegistry[lifecycle] as MiddlewareRegistrationInput[];

    current.push(...middlewares);

    return this;
  }

  public addErrorFilters(filters: readonly ErrorFilterToken[]): this {
    this.errorFilterTokens.push(...filters);

    return this;
  }

  async start(context: HttpAdapterStartContext): Promise<void> {
    const workers = this.options.workers;
    const isSingleProcess = !workers || workers === 1;

    if (isSingleProcess) {
      this.httpServer = new BunnerHttpServer();

      const runtimeContext = getRuntimeContext();

      await this.httpServer.boot(context.container, {
        ...this.options,
        metadata: runtimeContext.metadataRegistry,
        scopedKeys: runtimeContext.scopedKeys,
        middlewares: this.middlewareRegistry,
        errorFilters: this.errorFilterTokens,
        internalRoutes: this.internalRoutes,
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
      entryModule: sanitizedEntryModule,
      options: {
        ...this.options,
        middlewares: this.middlewareRegistry,
        errorFilters: this.errorFilterTokens,
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
    const isAotRuntime = getRuntimeContext().isAotRuntime === true;

    if (isAotRuntime) {
      return new URL('./bunner-http-worker.ts', import.meta.url);
    }

    return new URL(Bun.argv[1] ?? '', 'file://');
  }
}
