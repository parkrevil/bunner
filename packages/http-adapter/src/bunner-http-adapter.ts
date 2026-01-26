import type { BunnerAdapter, BunnerRecord, Class, Context, ErrorFilterToken } from '@bunner/common';

import { ClusterManager, getRuntimeContext, type ClusterBaseWorker } from '@bunner/core';

import { BunnerHttpServer } from './bunner-http-server';
import type {
  BunnerHttpInternalChannel,
  BunnerHttpServerOptions,
  HttpAdapterStartContext,
  HttpMiddlewareRegistry,
  InternalRouteHandler,
  InternalRouteEntry,
  MiddlewareRegistrationInput,
} from './interfaces';
import { HttpMiddlewareLifecycle } from './interfaces';
import type { ClassMetadata, HttpWorkerRpc, MetadataRegistryKey } from './types';

const BUNNER_HTTP_INTERNAL = Symbol.for('bunner:http:internal');

export class BunnerHttpAdapter implements BunnerAdapter {
  private options: BunnerHttpServerOptions;
  private clusterManager: ClusterManager<ClusterBaseWorker & HttpWorkerRpc> | undefined;
  private httpServer: BunnerHttpServer | undefined;

  private [BUNNER_HTTP_INTERNAL]?: BunnerHttpInternalChannel;

  private internalRoutes: InternalRouteEntry[] = [];

  private middlewareRegistry: HttpMiddlewareRegistry = {};

  private errorFilterTokens: ErrorFilterToken[] = [];

  constructor(options: BunnerHttpServerOptions = {}) {
    const normalizedOptions: BunnerHttpServerOptions = {
      port: 5000,
      bodyLimit: 10 * 1024 * 1024,
      trustProxy: false,
      ...options,
      name: 'bunner-http',
      logLevel: 'debug',
    };

    this.options = normalizedOptions;

    this[BUNNER_HTTP_INTERNAL] = {
      get: (path: string, handler: InternalRouteHandler) => {
        this.internalRoutes.push({ method: 'GET', path, handler });
      },
    };
  }

  public addMiddlewares(lifecycle: HttpMiddlewareLifecycle, middlewares: readonly MiddlewareRegistrationInput[]): this {
    const current = this.middlewareRegistry[lifecycle];
    const updated = current ? [...current, ...middlewares] : [...middlewares];

    this.middlewareRegistry[lifecycle] = updated;

    return this;
  }

  public addErrorFilters(filters: readonly ErrorFilterToken[]): this {
    this.errorFilterTokens.push(...filters);

    return this;
  }

  async start(context: Context): Promise<void> {
    const startContext = this.toStartContext(context);
    const workers = this.options.workers;
    const isSingleProcess = workers === undefined || workers === 1;

    if (isSingleProcess) {
      this.httpServer = new BunnerHttpServer();

      const runtimeContext = getRuntimeContext();

      await this.httpServer.boot(startContext.container, {
        ...this.options,
        metadata: this.normalizeMetadataRegistry(runtimeContext.metadataRegistry),
        scopedKeys: runtimeContext.scopedKeys,
        middlewares: this.middlewareRegistry,
        errorFilters: this.errorFilterTokens,
        internalRoutes: this.internalRoutes,
      });

      return;
    }

    // === Multi Process Mode (Cluster) ===
    const entryModule = startContext.entryModule;

    if (!entryModule) {
      throw new Error('Entry Module not found in context. Cannot start Cluster Mode.');
    }

    const script = this.resolveWorkerScript();

    this.clusterManager = new ClusterManager<ClusterBaseWorker & HttpWorkerRpc>({
      script,
      size: workers,
    });

    const sanitizedEntryModule = {
      path: 'unknown',
      className: entryModule.name,
    };
    const initParams: BunnerRecord = {
      entryModule: {
        path: sanitizedEntryModule.path,
        className: sanitizedEntryModule.className,
      },
      options: {
        ...this.options,
        middlewares: this.middlewareRegistry,
        errorFilters: this.errorFilterTokens,
      },
    };

    await this.clusterManager.init(initParams);
    await this.clusterManager.bootstrap();
  }

  async stop(): Promise<void> {
    if (this.clusterManager !== undefined) {
      await this.clusterManager.destroy();
    }
  }

  public getInternalChannel(): BunnerHttpInternalChannel | undefined {
    return this[BUNNER_HTTP_INTERNAL];
  }

  protected resolveWorkerScript(): URL {
    const isAotRuntime = getRuntimeContext().isAotRuntime === true;

    if (isAotRuntime) {
      return new URL('./bunner-http-worker.ts', import.meta.url);
    }

    return new URL(Bun.argv[1] ?? '', 'file://');
  }

  private toStartContext(context: Context): HttpAdapterStartContext {
    if (!this.isStartContext(context)) {
      throw new Error('Adapter context missing container.');
    }

    return context;
  }

  private isStartContext(value: Context): value is HttpAdapterStartContext {
    return typeof value === 'object' && value !== null && 'container' in value;
  }

  private normalizeMetadataRegistry(
    registry: Map<MetadataRegistryKey, ClassMetadata> | Map<Class, ClassMetadata> | undefined,
  ): Map<MetadataRegistryKey, ClassMetadata> | undefined {
    if (!registry) {
      return undefined;
    }

    const normalized = new Map<MetadataRegistryKey, ClassMetadata>();

    for (const [key, value] of registry.entries()) {
      if (this.isClassToken(key)) {
        normalized.set(key, value);
      }
    }

    return normalized;
  }

  private isClassToken(value: MetadataRegistryKey | Class): value is MetadataRegistryKey {
    return typeof value === 'function' && value.length === 0;
  }
}
