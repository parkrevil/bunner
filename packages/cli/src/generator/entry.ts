import type { GenerateConfig } from './interfaces';

export class EntryGenerator {
  generate(userMainImportPath: string, isDev: boolean, config: GenerateConfig = {}): string {
    const manifestExt = isDev ? 'ts' : 'js';
    const workersConfig = config.workers;
    let workersCount = 'Math.floor(navigator.hardwareConcurrency / 2) || 1';

    if (typeof workersConfig === 'number') {
      workersCount = workersConfig.toString();
    } else if (Array.isArray(workersConfig)) {
      workersCount = workersConfig.length.toString();
    }

    return `
const isWorker = !!process.env.BUNNER_WORKER_ID;

let container;
let metadata;

if (isWorker) {
  // === Worker Context ===
  const { createContainer, createMetadataRegistry, createScopedKeysMap, registerDynamicModules } = await import("./manifest");
  const { expose } = await import("@bunner/core");
  
  // Expose dummy interface to satisfy ClusterManager handshake
  expose({
    init: () => Promise.resolve(),
    bootstrap: () => Promise.resolve(),
    destroy: () => Promise.resolve()
  });

  console.log("${isDev ? '🌟 Bunner Worker Started (Generated)' : '[Entry] Worker Initializing...'}");

  globalThis.__BUNNER_MANIFEST_PATH__ = import.meta.resolve("./manifest.${manifestExt}"); 
  container = createContainer();
  metadata = createMetadataRegistry();
  const scopedKeys = createScopedKeysMap();

  globalThis.__BUNNER_CONTAINER__ = container;
  globalThis.__BUNNER_METADATA_REGISTRY__ = metadata;
  globalThis.__BUNNER_SCOPED_KEYS__ = scopedKeys;
  
  if (typeof registerDynamicModules === 'function') {
     await registerDynamicModules(container);
  }

  console.log("[Entry] Bootstrapping User Application...");

  // Load User Entry (runs Bunner.create -> createRuntime)
  await import("${userMainImportPath}");

} else {
  // === Supervisor Context ===
  console.log("${isDev ? '🌟 Bunner Supervisor Started' : '[Entry] Supervisor Initializing...'}");
  const { ClusterManager } = await import("@bunner/core");
  
  const manager = new ClusterManager({
     script: new URL(import.meta.url),
     size: ${workersCount},
  });
  
  // We don't need to send complex init params because main.ts has them
  // We just ensure workers are spawned
  await manager.bootstrap();
}

${isDev ? 'export { container, metadata };' : ''}
`;
  }
}
