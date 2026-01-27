import { runInNewContext } from 'node:vm';
import { basename, join, relative } from 'path';
import { ModuleKind, ScriptTarget, transpileModule } from 'typescript';

import type { ConfigLoadResult, ConfigModule, JsonRecord, JsonValue, ResolvedBunnerConfig } from './interfaces';

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
            : await ConfigLoader.loadJsonConfig(candidate.path, cwd);
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

  private static isRecord(value: JsonValue | undefined): value is JsonRecord {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private static isNonEmptyString(value: JsonValue | undefined): value is string {
    return typeof value === 'string' && value.length > 0;
  }

  private static isStringArray(value: JsonValue | undefined): value is string[] {
    return Array.isArray(value) && value.every(entry => typeof entry === 'string');
  }

  private static toResolvedConfig(value: JsonValue, sourcePath: string): ResolvedBunnerConfig {
    if (!this.isRecord(value)) {
      throw new ConfigLoadError('Invalid bunner config: must be an object.', sourcePath);
    }

    const moduleValue = value.module;

    if (!this.isRecord(moduleValue)) {
      throw new ConfigLoadError('Invalid bunner config: module is required.', sourcePath);
    }

    const fileName = moduleValue.fileName;

    if (!this.isNonEmptyString(fileName)) {
      throw new ConfigLoadError('Invalid bunner config: module.fileName is required.', sourcePath);
    }

    const config: ResolvedBunnerConfig = {
      module: { fileName },
    };
    const entry = value.entry;

    if (typeof entry === 'string') {
      config.entry = entry;
    }

    const workers = value.workers;

    if (typeof workers === 'number') {
      config.workers = workers;
    } else if (workers === 'full' || workers === 'half') {
      config.workers = workers;
    } else if (this.isStringArray(workers)) {
      config.workers = workers;
    }

    const port = value.port;

    if (typeof port === 'number') {
      config.port = port;
    }

    const compiler = value.compiler;

    if (this.isRecord(compiler)) {
      const compilerConfig: ResolvedBunnerConfig['compiler'] = {};
      const strictValidation = compiler.strictValidation;
      const minify = compiler.minify;
      const profile = compiler.profile;

      if (typeof strictValidation === 'boolean') {
        compilerConfig.strictValidation = strictValidation;
      }

      if (typeof minify === 'boolean') {
        compilerConfig.minify = minify;
      }

      if (profile === 'minimal' || profile === 'standard' || profile === 'full') {
        compilerConfig.profile = profile;
      }

      config.compiler = compilerConfig;
    }

    const scanPaths = value.scanPaths;

    if (this.isStringArray(scanPaths)) {
      config.scanPaths = scanPaths;
    }

    return config;
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

  private static async loadJsonConfig(path: string, cwd: string): Promise<ResolvedBunnerConfig> {
    const sourcePath = relative(cwd, path);
    const rawText = await Bun.file(path).text();
    const parsed = JSON.parse(rawText);

    return this.toResolvedConfig(parsed, sourcePath);
  }
}
