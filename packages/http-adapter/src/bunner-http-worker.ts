import type { BunnerRecord, ProviderToken } from '@bunner/common';
import { ClusterBaseWorker, Container, type ClusterWorkerId, expose } from '@bunner/core';
import type { RpcArgs, RpcCallable } from '@bunner/core/src/cluster/types';
import { Logger } from '@bunner/logger';

import { BunnerHttpServer } from './bunner-http-server';
import type { BunnerHttpServerBootOptions, HttpWorkerInitParams, HttpWorkerManifest } from './interfaces';
import type { ClassMetadata, ControllerConstructor } from './types';

class BunnerHttpWorker extends ClusterBaseWorker {
  private logger = new Logger(BunnerHttpWorker.name);
  private httpServer: BunnerHttpServer;

  constructor() {
    super();
  }

  getId() {
    return this.id;
  }

  override async init(workerId: ClusterWorkerId, params: Parameters<ClusterBaseWorker['init']>[1]) {
    await super.init(workerId, params);

    this.logger.info(`🔧 Bunner HTTP Worker #${workerId} is initializing...`);

    if (!this.isHttpWorkerInitParams(params)) {
      throw new Error('Invalid worker init params for BunnerHttpWorker.');
    }

    const { options, entryModule } = params;
    const manifestPath = entryModule.manifestPath;

    if (typeof manifestPath === 'string' && manifestPath.length > 0) {
      this.logger.info(`⚡ AOT Worker Load: ${manifestPath}`);

      const manifestModule: unknown = await import(manifestPath);

      if (!this.isHttpWorkerManifest(manifestModule)) {
        throw new Error('Invalid AOT manifest module. Missing createContainer().');
      }

      const manifest = manifestModule;
      const container = manifest.createContainer();
      const metadataRegistry =
        manifest.createMetadataRegistry?.() ?? new Map<ControllerConstructor, ClassMetadata>();
      const scopedKeysMap = manifest.createScopedKeysMap?.() ?? new Map<ProviderToken, string>();

      if (typeof manifest.registerDynamicModules === 'function') {
        this.logger.info('⚡ Loading Dynamic Modules...');

        await manifest.registerDynamicModules(container);
      }

      this.httpServer = new BunnerHttpServer();

      // Pass combined options including metadata for Runtime to use
      const bootOptions: BunnerHttpServerBootOptions = {
        ...options,
        metadata: metadataRegistry,
        scopedKeys: scopedKeysMap,
      };

      await this.httpServer.boot(container, bootOptions);
    } else {
      this.logger.warn('⚠️ Standard Mode (JIT) - Booting without AOT Manifest');

      // Basic JIT Container Setup
      const container = new Container();

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

  private isHttpWorkerManifest(value: unknown): value is HttpWorkerManifest {
    if (!this.isRecord(value)) {
      return false;
    }

    const createContainer = value.createContainer;

    return typeof createContainer === 'function';
  }

  private isHttpWorkerInitParams(value: unknown): value is HttpWorkerInitParams {
    if (!this.isRecord(value)) {
      return false;
    }

    const entryModule = value.entryModule;
    const options = value.options;

    if (!this.isRecord(entryModule)) {
      return false;
    }

    if (typeof entryModule.className !== 'string') {
      return false;
    }

    return this.isRecord(options);
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}

const worker = new BunnerHttpWorker();

const initWorker: RpcCallable = async (...args: RpcArgs) => {
  const workerId = typeof args[0] === 'number' ? args[0] : 0;
  const params = args.length > 1 && isBunnerRecord(args[1]) ? args[1] : undefined;

  await worker.init(workerId, params);

  return null;
};

const bootstrapWorker: RpcCallable = () => {
  worker.bootstrap();

  return null;
};

const destroyWorker: RpcCallable = () => {
  worker.destroy();

  return null;
};

const getWorkerStats: RpcCallable = () => {
  const stats = worker.getStats();

  return { cpu: stats.cpu, memory: stats.memory };
};

expose({
  init: initWorker,
  bootstrap: bootstrapWorker,
  destroy: destroyWorker,
  getStats: getWorkerStats,
});

function isBunnerRecord(value: unknown): value is BunnerRecord {
  return typeof value === 'object' && value !== null;
}

export { BunnerHttpWorker };
