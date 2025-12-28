import { join, resolve } from 'path';

import { Logger } from '@bunner/logger';
import { Glob } from 'bun';

import { AstParser, ModuleGraph } from '../analyzer';
import { ConfigLoader } from '../common';
import { EntryGenerator, InjectorGenerator, ManifestGenerator } from '../generator';
import { ImportRegistry } from '../generator/import-registry';
import { ProjectWatcher } from '../watcher';

export async function dev() {
  const logger = new Logger('CLI:Dev');

  logger.info('🚀 Starting Bunner Dev Server...');

  const config = await ConfigLoader.load();
  const projectRoot = process.cwd();
  const srcDir = resolve(projectRoot, 'src');
  const outDir = resolve(projectRoot, '.bunner');
  const parser = new AstParser();
  const fileCache = new Map<string, any>(); // Map<string, FileAnalysis>

  async function analyzeFile(filePath: string) {
    try {
      const fileContent = await Bun.file(filePath).text();
      const parseResult = parser.parse(filePath, fileContent);

      fileCache.set(filePath, {
        filePath: filePath,
        classes: parseResult.classes,
        reExports: parseResult.reExports,
        exports: parseResult.exports,
        imports: parseResult.imports,
        moduleDefinition: parseResult.moduleDefinition,
      });

      return true;
    } catch (e) {
      logger.error(`❌ Parse Error (${filePath})`, e);

      return false;
    }
  }

  async function rebuild() {
    // Flatten classes for Manifest legacy support if needed
    const allFileAnalyses = Array.from(fileCache.values());
    const allClasses = allFileAnalyses.flatMap((f: any) =>
      (f.classes || []).map((metadata: any) => ({ metadata, filePath: f.filePath })),
    );

    logger.debug(`🛠️  Rebuilding injection map (${allClasses.length} classes)...`);

    // Create FileMap for Graph
    const fileMap = new Map(fileCache.entries());
    const graph = new ModuleGraph(fileMap);

    graph.build();

    logger.info(`Graph Size: ${graph.modules.size} modules`);

    const injectorGen = new InjectorGenerator();
    const registry = new ImportRegistry(outDir);
    const injectorCode = injectorGen.generate(graph, registry);

    await Bun.write(join(outDir, 'injector.ts'), injectorCode);

    const manifestGen = new ManifestGenerator();
    const manifestCode = manifestGen.generate(graph, allClasses, outDir);

    await Bun.write(join(outDir, 'manifest.ts'), manifestCode);

    const userMain = join(srcDir, 'main.ts');
    const entryGen = new EntryGenerator();
    const indexContent = entryGen.generate(userMain, true, config);

    await Bun.write(join(outDir, 'index.ts'), indexContent);
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

  logger.info('🔍 Initial Scan...');

  for await (const file of glob.scan(srcDir)) {
    const fullPath = join(srcDir, file);

    if (!shouldAnalyzeFile(fullPath)) {
      continue;
    }

    await analyzeFile(fullPath);
  }

  if (config.scanPaths) {
    for (const scanPath of config.scanPaths) {
      const absPath = resolve(projectRoot, scanPath);

      logger.info(`🔍 Scanning additional path: ${scanPath}`);

      for await (const file of glob.scan(absPath)) {
        const fullPath = join(absPath, file);

        if (!shouldAnalyzeFile(fullPath)) {
          continue;
        }

        await analyzeFile(fullPath);
      }
    }
  }

  await rebuild();

  const appEntry = join(outDir, 'index.ts');

  logger.info('🚀 Spawning App', { command: `bun run --watch ${appEntry}` });

  const appProc = Bun.spawn(['bun', 'run', '--watch', appEntry], {
    stdout: 'inherit',
    stderr: 'inherit',
    env: { ...process.env, FORCE_COLOR: '1' },
  });
  // 5. Watcher
  const projectWatcher = new ProjectWatcher(srcDir);

  projectWatcher.start(event => {
    void (async () => {
      const filename = event.filename;

      // Debounce or immediate? For now immediate.
      if (!filename) {
        return;
      }

      const fullPath = join(srcDir, filename);

      logger.debug(`🔄 [${event.eventType}] Detected change in: ${filename}`);

      if (event.eventType === 'rename' && !(await Bun.file(fullPath).exists())) {
        // Deleted
        logger.info(`🗑️ File deleted: ${filename}`);

        fileCache.delete(fullPath);
      } else {
        // Changed or Created
        await analyzeFile(fullPath);
      }

      // Incremental Rebuild Trigger
      await rebuild();
    })();
  });
  process.on('SIGINT', () => {
    projectWatcher.close();
    appProc.kill();
    process.exit(0);
  });
}
