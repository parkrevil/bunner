import { join, resolve } from 'path';

import { Glob } from 'bun';

import { AstParser, ModuleGraph, type ClassMetadata, type FileAnalysis } from '../analyzer';
import { ConfigLoader, scanGlobSorted } from '../common';
import { EntryGenerator, ImportRegistry, InjectorGenerator, ManifestGenerator } from '../generator';
import { ProjectWatcher } from '../watcher';

export async function dev() {
  console.info('🚀 Starting Bunner Dev...');

  const config = await ConfigLoader.load();
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
    const allClasses: Array<{ metadata: ClassMetadata; filePath: string }> = allFileAnalyses.flatMap(f => {
      return f.classes.map(metadata => ({ metadata, filePath: f.filePath }));
    });
    const fileMap = new Map(fileCache.entries());
    const graph = new ModuleGraph(fileMap);

    graph.build();

    const injectorGen = new InjectorGenerator();
    const registry = new ImportRegistry(outDir);
    const injectorCode = injectorGen.generate(graph, registry);

    await Bun.write(join(outDir, 'injector.ts'), injectorCode);

    const manifestGen = new ManifestGenerator();
    const manifestCode = manifestGen.generate(graph, allClasses, outDir);

    await Bun.write(join(outDir, 'manifest.ts'), manifestCode);

    const userMain = join(srcDir, 'main.ts');
    const entryGen = new EntryGenerator();
    const indexContent = entryGen.generate(userMain, true, { workers: config.workers });

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
  console.info(`   Entry: ${join(outDir, 'index.ts')}`);

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
}
