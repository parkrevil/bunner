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

    const runtimeFileName = ${isDev ? "'./runtime.ts'" : "'./runtime.js'"};
    await import(runtimeFileName);

    console.log("[Entry] Loading Application Module...");

    await import("${userMainImportPath}");


  } catch (err) {
    throw err;
  }
}
`;
  }
}
