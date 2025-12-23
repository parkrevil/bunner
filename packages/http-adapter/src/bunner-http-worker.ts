import { ClusterBaseWorker, type ClusterWorkerId, expose } from '@bunner/core';
import { Logger } from '@bunner/logger';

import { BunnerHttpServer } from './bunner-http-server';

export class BunnerHttpWorker extends ClusterBaseWorker {
  private logger = new Logger(BunnerHttpWorker);
  private httpServer: BunnerHttpServer;

  constructor() {
    super();
  }

  getId() {
    return this.id;
  }

  override async init(workerId: ClusterWorkerId, params: any) {
    await super.init(workerId, params);
    this.logger.info(`🔧 Bunner HTTP Worker #${workerId} is initializing...`);

    const { options, entryModule } = params;

    if (entryModule.manifestPath) {
      this.logger.info(`⚡ AOT Worker Load: ${entryModule.manifestPath}`);
      const manifest = await import(entryModule.manifestPath);

      const container = manifest.createContainer();
      const metadataRegistry = manifest.createMetadataRegistry() || new Map();
      const scopedKeysMap = typeof manifest.createScopedKeysMap === 'function' ? manifest.createScopedKeysMap() : new Map();

      if (typeof manifest.registerDynamicModules === 'function') {
        this.logger.info('⚡ Loading Dynamic Modules...');
        await manifest.registerDynamicModules(container);
      }

      this.httpServer = new BunnerHttpServer();

      // Pass combined options including metadata for Runtime to use
      await this.httpServer.boot(container, {
        ...options,
        metadata: metadataRegistry,
        scopedKeys: scopedKeysMap,
      });
    } else {
      this.logger.warn('⚠️ Standard Mode (JIT) - Booting without AOT Manifest');

      // Basic JIT Container Setup
      const { Container } = await import('@bunner/core');
      const container = new Container();

      // Load User Root Module to ensure they are in memory
      if (entryModule.path) {
        await import(entryModule.path);
      }

      this.httpServer = new BunnerHttpServer();

      // Boot without pre-compiled metadata - Runtime will rely on what's available
      await this.httpServer.boot(container, options);
    }
  }

  bootstrap() {
    this.logger.info(`🚀 Bunner HTTP Worker #${this.id} is bootstrapping...`);
  }

  destroy() {
    this.logger.info(`🛑 Worker #${this.id} is destroying...`);
  }
}

expose(new BunnerHttpWorker());
