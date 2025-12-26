import type { BunnerAdapter, ErrorFilterToken } from '@bunner/common';
import { ClusterManager, type ClusterBaseWorker, type BunnerApplicationNormalizedOptions } from '@bunner/core';

import { BunnerHttpServer } from './bunner-http-server';
import {
  HttpMiddlewareLifecycle,
  type BunnerHttpServerOptions,
  type HttpMiddlewareRegistry,
  type MiddlewareRegistrationInput,
} from './interfaces';

const BUNNER_HTTP_INTERNAL = Symbol.for('bunner:http:internal');

type InternalRouteMethod = 'GET';
type InternalRouteHandler = (...args: readonly unknown[]) => unknown;
type InternalRouteEntry = {
  method: InternalRouteMethod;
  path: string;
  handler: InternalRouteHandler;
};

type BunnerHttpInternalChannel = {
  get(path: string, handler: InternalRouteHandler): void;
};

type BunnerHttpInternalHost = {
  [key: symbol]: BunnerHttpInternalChannel | undefined;
};

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

    const internalHost = this as unknown as BunnerHttpInternalHost;

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

  async start(context: any): Promise<void> {
    const workers = (this.options as any).workers;
    const isSingleProcess = !workers || workers === 1;

    if (isSingleProcess) {
      this.httpServer = new BunnerHttpServer();

      await this.httpServer.boot(context.container, {
        ...this.options,
        metadata: (globalThis as any).__BUNNER_METADATA_REGISTRY__,
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
      entryModule: sanitizedEntryModule as any,
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
    const hasAotManifest = !!(globalThis as any).__BUNNER_MANIFEST_PATH__;

    if (hasAotManifest) {
      return new URL('./bunner-http-worker.ts', import.meta.url);
    }

    return new URL(process.argv[1] || '', 'file://');
  }
}
