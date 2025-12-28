import type { GenerateConfig } from './interfaces';

export class EntryGenerator {
  generate(userMainImportPath: string, isDev: boolean, config: GenerateConfig = {}): string {
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

    return `
const isWorker = !!process.env.BUNNER_WORKER_ID;

if (!isWorker) {
  const workersCount = ${workersCount};
  if (workersCount <= 1) {
    await bootstrap();
  } else {
    console.log(\`[Cluster] Master process starting with \${workersCount} workers...\`);

    const { ClusterManager } = await import("@bunner/core");

    new ClusterManager({
      size: workersCount,
      script: new URL(import.meta.url),
    });
  }
} else {
  await bootstrap();
}

async function bootstrap() {
  try {
    console.log("${isDev ? '🌟 Bunner Server Starting (AOT)...' : '[Entry] Server Initializing...'}");

    const manifestFileName = ${isDev ? "'./manifest.ts'" : "'./manifest.js'"};
    const manifestUrl = new URL(manifestFileName, import.meta.url);

    (globalThis as any).__BUNNER_MANIFEST_PATH__ = manifestUrl.href;

    const manifest = await import(manifestFileName);

    if (typeof (manifest as any).createScopedKeysMap === 'function') {
      (globalThis as any).__BUNNER_SCOPED_KEYS__ = (manifest as any).createScopedKeysMap();
    }

    const injector = {
      createContainer: (manifest as any).createContainer,
      adapterConfig: (manifest as any).adapterConfig,
      registerDynamicModules: (manifest as any).registerDynamicModules,
    };
    const { BunnerApplication } = await import("@bunner/core");
    
    const container = injector.createContainer();
    
    // Set Global Container for BunnerApplication to pick up
    globalThis.__BUNNER_CONTAINER__ = container;
    
    // Configure Adapters (Global Defaults from AOT)
    // We can expose adapterConfig globally or let the app handle it.
    // For now, let's just make it available if needed.
    globalThis.__BUNNER_ADAPTER_CONFIG__ = injector.adapterConfig;

    console.log("[Entry] Loading Application Module...");

    // Load User Entry (runs Bunner.create -> BunnerApplication.init)
    await import("${userMainImportPath}");

  } catch (err) {
    console.error('[Entry Error] Failed to bootstrap application:', err);
    throw err;
  }
}
`;
  }
}
