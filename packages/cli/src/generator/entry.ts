import type { GenerateConfig } from './interfaces';

export class EntryGenerator {
  generate(userMainImportPath: string, isDev: boolean, config: GenerateConfig = {}): string {
    const manifestExt = isDev ? 'ts' : 'js';
    const workersConfig = config.workers;
    let workersCount = 'Math.floor(navigator.hardwareConcurrency / 2) || 1';

    if (typeof workersConfig === 'number') {
      if (workersConfig === 0) {
        workersCount = 'navigator.hardwareConcurrency';
      } else {
        workersCount = workersConfig.toString();
      }
    } else if (typeof workersConfig === 'string') {
      if (workersConfig === 'full') {
        workersCount = 'navigator.hardwareConcurrency';
      } else if (workersConfig === 'half') {
        workersCount = 'Math.floor(navigator.hardwareConcurrency / 2) || 1';
      } else if (/^\d+\/\d+$/.test(workersConfig)) {
        const [num, denom] = workersConfig.split('/').map(Number);

        workersCount = `Math.floor(navigator.hardwareConcurrency * (${num} / ${denom})) || 1`;
      } else if (!isNaN(Number(workersConfig))) {
        workersCount = Number(workersConfig).toString();
      }
    } else if (Array.isArray(workersConfig)) {
      workersCount = workersConfig.length.toString();
    }

    // Simplified Entry: No ClusterManager, just straight boot
    return `
const isWorker = !!process.env.BUNNER_WORKER_ID;

if (!isWorker) {
  // === Main Process ===
  const workersCount = ${workersCount};
  
  console.log(\`[Cluster] Master process starting with \${workersCount} workers...\`);
  
  const { ClusterManager } = await import("@bunner/core");
  
  new ClusterManager({
    size: workersCount,
    script: new URL(import.meta.url),
  });

} else {
  // === Worker Process ===
  await bootstrap();
}

async function bootstrap() {
  let container;
  let metadata;

  try {
    // === Bootstrapping ===
    console.log("${isDev ? '🌟 Bunner Server Starting...' : '[Entry] Server Initializing...'}");

    const { createContainer, createMetadataRegistry, createScopedKeysMap, registerDynamicModules } = await import("./manifest");
    const { Container } = await import("@bunner/core");
    
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
  
    console.log("[Entry] Loading Application Module...");
  
    // Load User Entry (runs Bunner.create -> BunnerApplication.init)
    await import("${userMainImportPath}");
  
  } catch (err) {
    console.error('[Entry Error] Failed to bootstrap application:', err);
    throw err;
  }
}

${isDev ? 'export { container, metadata };' : ''}
`;
  }
}
