import type { BunnerAdapter } from '@bunner/common';
import { ClusterManager, type ClusterBaseWorker, type BunnerApplicationNormalizedOptions } from '@bunner/core';

import { type BunnerHttpServerOptions } from './interfaces';
import { HttpRuntime } from './runtime';

export class BunnerHttpAdapter implements BunnerAdapter {
  private options: BunnerApplicationNormalizedOptions & BunnerHttpServerOptions;
  private clusterManager: ClusterManager<ClusterBaseWorker>;
  private localRuntime: HttpRuntime | undefined;

  constructor(options: BunnerHttpServerOptions = {}) {
    this.options = {
      port: 5000,
      bodyLimit: 10 * 1024 * 1024,
      trustProxy: false,
      ...options,
      // Default name/logLevel might be needed if Runtime expects them
      name: 'bunner-http',
      logLevel: 'debug',
    } as any;
  }

  async start(context: any): Promise<void> {
    const workers = (this.options as any).workers;
    const isSingleProcess = !workers || workers === 1;

    if (isSingleProcess) {
      this.localRuntime = new HttpRuntime();
      await this.localRuntime.boot(context.container, {
        ...this.options,
        metadata: (globalThis as any).__BUNNER_METADATA_REGISTRY__, // Fallback if not in context
      });
      // HttpRuntime.boot creates server but doesn't log "initialized"?
      // It logs "Server listening".
      return;
    }

    // === Multi Process Mode (Cluster) ===

    // We need entryModule metadata for ClusterManager
    // BunnerApplication passes entryModule in context
    const entryModule = context.entryModule;

    if (!entryModule) {
      throw new Error('Entry Module not found in context. Cannot start Cluster Mode.');
    }

    const script = this.resolveWorkerScript();

    this.clusterManager = new ClusterManager<ClusterBaseWorker>({
      script,
      size: workers,
    });

    // We need to construct EntryModuleMetadata format expected by ClusterManager
    const sanitizedEntryModule = {
      path: 'unknown', // TODO: Need mechanism to get file path of entry module class?
      // Or we assume JIT mode where script is process.argv[1]
      className: entryModule.name,
      // manifestPath?
    };

    // Note: ClusterManager.init expects EntryModuleMetadata which has path/manifestPath.
    // BaseApplication was getting it from constructor injection via Bunner.create.
    // In new architecture, we might lose the 'path' info if just passed Class.
    // However, for JIT (standard), 'script' (process.argv[1]) is what matters.
    // 'sanitizedEntryModule' is passed to workers.

    await this.clusterManager.init({
      entryModule: sanitizedEntryModule as any,
      options: this.options,
    });

    await this.clusterManager.bootstrap();
  }

  async stop(): Promise<void> {
    if (this.clusterManager) {
      await this.clusterManager.destroy();
    }
    // Local runtime stop if exists? HttpRuntime doesn't expose stop/close yet specifically in interface?
    // Server.stop() is implicit?
  }

  protected resolveWorkerScript(): URL {
    const hasAotManifest = !!(globalThis as any).__BUNNER_MANIFEST_PATH__;
    if (hasAotManifest) {
      // AOT logic - simplified for now
      return new URL('./bunner-http-worker.ts', import.meta.url);
    }
    return new URL(process.argv[1] || '', 'file://');
  }
}
