import { basename, join, relative } from 'path';
import { runInNewContext } from 'node:vm';
import { ModuleKind, ScriptTarget, transpileModule } from 'typescript';

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

        const resolved =
          candidate.format === 'ts'
            ? await ConfigLoader.loadTsConfig(candidate.path, cwd)
            : await Bun.file(candidate.path).json<ResolvedBunnerConfig>();
        const moduleConfig = resolved.module;
        const fileName = moduleConfig?.fileName;

        if (moduleConfig === undefined || moduleConfig === null || Array.isArray(moduleConfig)) {
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

  private static async loadTsConfig(path: string, cwd: string): Promise<ResolvedBunnerConfig> {
    const source = await Bun.file(path).text();
    const output = transpileModule(source, {
      compilerOptions: {
        module: ModuleKind.CommonJS,
        target: ScriptTarget.ES2020,
      },
    }).outputText;
    const moduleContainer = { exports: {} as ConfigModule };
    const context = { module: moduleContainer, exports: moduleContainer.exports };

    runInNewContext(output, context);

    if (!moduleContainer.exports.bunnerConfig) {
      throw new ConfigLoadError('Invalid bunner config: bunnerConfig export is required.', relative(cwd, path));
    }

    return moduleContainer.exports.bunnerConfig;
  }
}
