import type { ClusterBaseWorker } from '../cluster/cluster-base-worker';
import { ClusterManager } from '../cluster/cluster-manager';
import { Container } from '../injector/container';
import type { BunnerRuntime } from '../runtime';

import type { BunnerApplicationBaseOptions, EntryModuleMetadata } from './interfaces';

// Helper type for Constructor
type Constructor<T> = new (...args: any[]) => T;

export abstract class BaseApplication<O extends BunnerApplicationBaseOptions = any> {
  protected options: Required<O>;
  protected clusterManager: ClusterManager<ClusterBaseWorker>;
  protected localRuntime: BunnerRuntime | undefined;

  constructor(
    protected readonly entryModule: EntryModuleMetadata,
    options: O,
  ) {
    this.options = options as Required<O>;
  }

  static async createRuntime(_rootModuleCls: any, options: any, context: any) {
    const RuntimeClass = (this as any).Runtime;

    if (!RuntimeClass) {
      throw new Error(`Adapter ${this.name} must define static Runtime property or override createRuntime.`);
    }

    const { Container } = await import('../injector/container');
    const runtime = new RuntimeClass();

    return {
      start: async () => {
        const container = context.container || new Container();
        const metadata = context.metadata || (globalThis as any).__BUNNER_METADATA_REGISTRY__ || new Map();
        const scopedKeys = (globalThis as any).__BUNNER_SCOPED_KEYS__ || new Map();

        await runtime.boot(container, {
          ...options,
          metadata,
          scopedKeys,
        });
      },
      shutdown: async () => {},
    };
  }

  async init(): Promise<void> {
    const isSingleProcess = this.options.workers === 1;

    if (isSingleProcess) {
      // === Single Process Mode (In-Process) ===
      const RuntimeClass = await this.getRuntimeClass();
      this.localRuntime = new RuntimeClass();

      const container = new Container();
      const metadataRegistry = (globalThis as any).__BUNNER_METADATA_REGISTRY__ || new Map();
      const scopedKeys = (globalThis as any).__BUNNER_SCOPED_KEYS__ || new Map();

      await this.localRuntime.boot(container, {
        ...this.options,
        metadata: metadataRegistry,
        scopedKeys,
      });

      console.log('✨ Bunner Server initialized (Single Process)');
      return;
    }

    // === Multi Process Mode (Cluster) ===

    // Resolve Worker Script
    const script = this.resolveWorkerScript();

    this.clusterManager = new ClusterManager<ClusterBaseWorker>({
      script,
      size: this.options.workers as number,
    });

    // Sanitize EntryModuleMetadata
    const sanitizedEntryModule: EntryModuleMetadata = {
      path: this.entryModule.path,
      className: this.entryModule.className,
      manifestPath: this.entryModule.manifestPath,
    };

    await this.clusterManager.init({
      entryModule: sanitizedEntryModule,
      options: this.options, // Pass all options
    });

    console.log('✨ Bunner Server initialized (Cluster Mode)');
  }

  async start(): Promise<void> {
    if (this.localRuntime) {
      // Runtime checks? Already booted.
      return;
    }
    if (this.clusterManager) {
      await this.clusterManager.bootstrap();
    }
  }

  async shutdown(_force = false): Promise<void> {
    console.log('🛑 Server shutting down...');
    if (this.clusterManager) {
      await this.clusterManager.destroy();
    }
    // Local runtime shutdown if supported
  }

  protected abstract getLibraryWorkerPath(): URL;

  protected abstract getRuntimeClass(): Promise<Constructor<BunnerRuntime>>;

  protected resolveWorkerScript(): URL {
    const hasAotManifest = !!(globalThis as any).__BUNNER_MANIFEST_PATH__;

    if (hasAotManifest) {
      return this.getLibraryWorkerPath();
    }
    // Standard Mode (JIT): Workers must run User Entry Point
    return new URL(process.argv[1] || '', 'file://');
  }
}
