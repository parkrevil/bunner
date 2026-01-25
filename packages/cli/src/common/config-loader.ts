import { basename, join, relative } from 'path';

import type { ConfigLoadResult, ConfigModule, ResolvedBunnerConfig } from './interfaces';

import { ConfigLoadError } from './errors';

export class ConfigLoader {
  static async load(cwd: string = process.cwd()): Promise<ConfigLoadResult> {
    const configCandidates = [
      { path: join(cwd, 'bunner.config.ts'), format: 'ts' as const },
      { path: join(cwd, 'bunner.config.json'), format: 'json' as const },
    ];

    for (const candidate of configCandidates) {
      if (!(await Bun.file(candidate.path).exists())) {
        continue;
      }

      try {
        console.info(`🔧 Loading config from ${candidate.path}`);

        const config =
          candidate.format === 'ts'
            ? ((await import(candidate.path)) as ConfigModule)
            : (JSON.parse(await Bun.file(candidate.path).text()) as ResolvedBunnerConfig);
        const resolved = (
          candidate.format === 'ts' ? ((config as ConfigModule).default ?? (config as unknown)) : config
        ) as ResolvedBunnerConfig;
        const moduleConfig = resolved?.module;
        const fileName = moduleConfig?.fileName;

        if (!moduleConfig || typeof moduleConfig !== 'object') {
          throw new ConfigLoadError('Invalid bunner config: module is required.', relative(cwd, candidate.path));
        }

        if (typeof fileName !== 'string' || fileName.length === 0) {
          throw new ConfigLoadError('Invalid bunner config: module.fileName is required.', relative(cwd, candidate.path));
        }

        if (basename(fileName) !== fileName || fileName.includes('/') || fileName.includes('\\')) {
          throw new ConfigLoadError(
            'Invalid bunner config: module.fileName must be a single filename.',
            relative(cwd, candidate.path),
          );
        }

        return {
          config: resolved,
          source: {
            path: relative(cwd, candidate.path),
            format: candidate.format,
          },
        };
      } catch (error) {
        if (error instanceof ConfigLoadError) {
          throw error;
        }

        throw new ConfigLoadError('Failed to load bunner config.', relative(cwd, candidate.path));
      }
    }

    throw new ConfigLoadError('Missing bunner config: bunner.config.ts or bunner.config.json is required.');
  }
}
