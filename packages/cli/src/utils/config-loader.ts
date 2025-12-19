import { join } from 'path';

export interface BunnerConfig {
  entry: string;
  port?: number;
  compiler?: {
    strictValidation?: boolean;
    minify?: boolean;
  };
}

export class ConfigLoader {
  static async load(cwd: string = process.cwd()): Promise<BunnerConfig> {
    const configPaths = [join(cwd, 'bunner.config.ts'), join(cwd, 'bunner.config.js')];

    for (const path of configPaths) {
      if (await Bun.file(path).exists()) {
        try {
          console.log(`🔧 Loading config from ${path}`);
          const mod = await import(path);
          return mod.default ?? mod;
        } catch (error) {
          console.error(`❌ Failed to load config at ${path}`, error);
          process.exit(1);
        }
      }
    }

    console.log('⚠️ No config found, using defaults.');
    return {
      entry: './src/main.ts',
    };
  }
}
