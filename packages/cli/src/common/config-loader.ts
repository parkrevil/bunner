import { join } from 'path';

import type { BunnerConfig } from './interfaces';

export class ConfigLoader {
  static async load(cwd: string = process.cwd()): Promise<BunnerConfig> {
    const configPaths = [join(cwd, 'bunner.config.ts'), join(cwd, 'bunner.config.js')];

    for (const path of configPaths) {
      if (await Bun.file(path).exists()) {
        try {
          console.info(`🔧 Loading config from ${path}`);

          const mod = await import(path);

          return mod.default ?? mod;
        } catch (error) {
          console.error(`❌ Failed to load config at ${path}`, error);

          throw error;
        }
      }
    }

    console.warn('⚠️ No config found, using defaults.');

    return {
      entry: './src/main.ts',
    };
  }
}
