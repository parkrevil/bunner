import { join, resolve } from 'path';

import { Logger } from '@bunner/logger';
import { Glob } from 'bun';

import { AstParser, type ClassMetadata } from '../analyzer/ast-parser';
import { ModuleGraph } from '../analyzer/graph/module-graph';
import { EntryGenerator } from '../generators/entry';
import { ManifestGenerator } from '../generators/manifest';
import { ConfigLoader } from '../utils/config-loader';
import { ProjectWatcher } from '../watcher/project-watcher';

export async function dev() {
  const logger = new Logger('CLI:Dev');
  logger.info('🚀 Starting Bunner Dev Server...');

  // 1. Load Config
  await ConfigLoader.load();
  const projectRoot = process.cwd();
  const srcDir = resolve(projectRoot, 'src');
  const outDir = resolve(projectRoot, '.bunner');

  // 2. Initialize Components

  const parser = new AstParser();
  const manifestGen = new ManifestGenerator();

  // State
  const fileCache = new Map<string, { metadata: ClassMetadata; filePath: string }[]>();

  async function analyzeFile(filePath: string) {
    try {
      const fileContent = await Bun.file(filePath).text();
      const metas = parser.parse(filePath, fileContent);

      const cacheEntries = metas.map(meta => ({ metadata: meta, filePath: filePath }));
      fileCache.set(filePath, cacheEntries);
      return true;
    } catch (e) {
      logger.error(`❌ Parse Error (${filePath})`, e);
      return false;
    }
  }

  async function rebuild() {
    const allClasses = Array.from(fileCache.values()).flat();
    logger.debug(`🛠️  Rebuilding manifest (${allClasses.length} classes)...`);

    // Build Module Graph
    const graph = new ModuleGraph(allClasses);
    graph.build();

    const manifestCode = manifestGen.generate(graph, allClasses, outDir);
    await Bun.write(join(outDir, 'manifest.ts'), manifestCode);

    // Inject global path for Worker access
    const userMain = join(srcDir, 'main.ts');
    const entryGen = new EntryGenerator();
    const indexContent = entryGen.generate(userMain, true);

    // Always overwrite index.ts in strict mode to ensure new exports
    await Bun.write(join(outDir, 'index.ts'), indexContent);
  }

  // 3. Initial Scan
  const glob = new Glob('**/*.ts');
  logger.info('🔍 Initial Scan...');
  for await (const file of glob.scan(srcDir)) {
    await analyzeFile(join(srcDir, file));
  }
  await rebuild();

  // 4. Spawn Child App
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
