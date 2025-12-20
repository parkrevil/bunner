import { join } from 'path';

import { Logger } from '@bunner/logger';

export interface BunnerConfig {
  entry: string;
  workers?: string[];
  port?: number;
  compiler?: {
    strictValidation?: boolean;
    minify?: boolean;
  };
  scanPaths?: string[]; 
}

export class ConfigLoader {
  private static readonly logger = new Logger('ConfigLoader');

  static async load(cwd: string = process.cwd()): Promise<BunnerConfig> {
    const configPaths = [join(cwd, 'bunner.config.ts'), join(cwd, 'bunner.config.js')];

    for (const path of configPaths) {
      if (await Bun.file(path).exists()) {
        try {
          this.logger.debug(`🔧 Loading config from ${path}`);
          const mod = await import(path);
          return mod.default ?? mod;
        } catch (error) {
          this.logger.error(`❌ Failed to load config at ${path}`, error);
          process.exit(1);
        }
      }
    }

    this.logger.warn('⚠️ No config found, using defaults.');
    return {
      entry: './src/main.ts',
    };
  }
}