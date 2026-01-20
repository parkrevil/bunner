import { join, resolve } from 'path';

import { Glob } from 'bun';

import { AstParser, ModuleGraph, type FileAnalysis } from '../analyzer';
import { ConfigLoader, ConfigLoadError, scanGlobSorted, writeIfChanged } from '../common';
import { buildDiagnostic, reportDiagnostics } from '../diagnostics';
import { EntryGenerator, ManifestGenerator } from '../generator';
import { ProjectWatcher } from '../watcher';

import type { CollectedClass } from './types';

export async function dev() {
  console.info('🚀 Starting Bunner Dev...');

  try {
    const configResult = await ConfigLoader.load();
    const config = configResult.config;
    const moduleFileName = config.module.fileName;
    const buildProfile = config.compiler?.profile ?? 'full';
    const projectRoot = process.cwd();
    const srcDir = resolve(projectRoot, 'src');
    const outDir = resolve(projectRoot, '.bunner');
    const parser = new AstParser();
    const fileCache = new Map<string, FileAnalysis>();

    async function analyzeFile(filePath: string) {
      try {
        const fileContent = await Bun.file(filePath).text();
        const parseResult = parser.parse(filePath, fileContent);

        fileCache.set(filePath, {
          filePath,
          classes: parseResult.classes,
          reExports: parseResult.reExports,
          exports: parseResult.exports,
          imports: parseResult.imports,
          moduleDefinition: parseResult.moduleDefinition,
        });

        return true;
      } catch (e) {
        console.error(`❌ Parse Error (${filePath})`, e);

        return false;
      }
    }

    async function rebuild() {
      const allFileAnalyses = Array.from(fileCache.values());
      const allClasses: CollectedClass[] = allFileAnalyses.flatMap(fileAnalysis => {
        return fileAnalysis.classes.map(metadata => ({ metadata, filePath: fileAnalysis.filePath }));
      });
      const fileMap = new Map(fileCache.entries());
      const graph = new ModuleGraph(fileMap, moduleFileName);

      graph.build();

      const manifestGen = new ManifestGenerator();
      const manifestJson = manifestGen.generateJson({
        graph,
        projectRoot,
        source: configResult.source,
        resolvedConfig: config,
      });
      const runtimeCode = manifestGen.generate(graph, allClasses, outDir);

      await writeIfChanged(join(outDir, 'manifest.json'), manifestJson);
      await writeIfChanged(join(outDir, 'runtime.ts'), runtimeCode);

      const userMain = join(srcDir, config.entry ?? 'main.ts');
      const entryGen = new EntryGenerator();
      const indexContent = entryGen.generate(userMain, true, { workers: config.workers });

      await writeIfChanged(join(outDir, 'entry.ts'), indexContent);

      if (!['minimal', 'standard', 'full'].includes(buildProfile)) {
        throw new Error(`Invalid build profile: ${buildProfile}`);
      }

      if (buildProfile === 'standard' || buildProfile === 'full') {
        const interfaceCatalogJson = JSON.stringify({ schemaVersion: '1', entries: [] }, null, 2);

        await writeIfChanged(join(outDir, 'interface-catalog.json'), interfaceCatalogJson);
      }

      if (buildProfile === 'full') {
        const runtimeReportJson = JSON.stringify({ schemaVersion: '1', adapters: [] }, null, 2);

        await writeIfChanged(join(outDir, 'runtime-report.json'), runtimeReportJson);
      }
    }

    function shouldAnalyzeFile(filePath: string): boolean {
      if (filePath.endsWith('.d.ts')) {
        return false;
      }

      if (filePath.endsWith('.spec.ts') || filePath.endsWith('.test.ts')) {
        return false;
      }

      return true;
    }

    const glob = new Glob('**/*.ts');
    const srcFiles = await scanGlobSorted({ glob, baseDir: srcDir });

    for (const file of srcFiles) {
      const fullPath = join(srcDir, file);

      if (!shouldAnalyzeFile(fullPath)) {
        continue;
      }

      await analyzeFile(fullPath);
    }

    if (config.scanPaths) {
      for (const scanPath of config.scanPaths) {
        const absPath = resolve(projectRoot, scanPath);
        const extraFiles = await scanGlobSorted({ glob, baseDir: absPath });

        for (const file of extraFiles) {
          const fullPath = join(absPath, file);

          if (!shouldAnalyzeFile(fullPath)) {
            continue;
          }

          await analyzeFile(fullPath);
        }
      }
    }

    await rebuild();

    console.info('🛠️  AOT artifacts generated.');
    console.info(`   Entry: ${join(outDir, 'entry.ts')}`);

    const projectWatcher = new ProjectWatcher(srcDir);

    projectWatcher.start(event => {
      void (async () => {
        const filename = event.filename;

        if (!filename) {
          return;
        }

        const fullPath = join(srcDir, filename);

        if (event.eventType === 'rename' && !(await Bun.file(fullPath).exists())) {
          console.info(`🗑️ File deleted: ${filename}`);

          fileCache.delete(fullPath);
        } else {
          await analyzeFile(fullPath);
        }

        await rebuild();
      })();
    });

    const onSigint = () => {
      projectWatcher.close();
    };

    process.on('SIGINT', onSigint);
  } catch (error) {
    const file = error instanceof ConfigLoadError && error.sourcePath ? error.sourcePath : '.';
    const reason = error instanceof Error ? error.message : 'Unknown dev error.';
    const diagnostic = buildDiagnostic({
      code: 'DEV_FAILED',
      severity: 'fatal',
      summary: 'Dev failed.',
      reason,
      file,
    });

    reportDiagnostics({ diagnostics: [diagnostic] });
    throw error;
  }
}
