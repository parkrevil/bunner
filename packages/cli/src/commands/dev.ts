import { watch } from 'node:fs'; // Bun native watch via node compat or fs.watch
import { join, resolve } from 'path';

import { Glob } from 'bun';

import { AstParser, type ClassMetadata } from '../analyzer/ast-parser';
import { SourceScanner } from '../analyzer/source-scanner';
import { ManifestGenerator } from '../generators/manifest';
import { ConfigLoader } from '../utils/config-loader';

export async function dev() {
  console.log('🚀 Starting Bunner Dev Server...');

  // 1. Load Config
  const _config = await ConfigLoader.load();
  const projectRoot = process.cwd();
  const srcDir = resolve(projectRoot, 'src');
  const outDir = resolve(projectRoot, '.bunner');

  // 2. Initialize Components

  const _scanner = new SourceScanner(); // Keep for future use
  const parser = new AstParser();
  const manifestGen = new ManifestGenerator();

  // State
  const fileCache = new Map<string, { metadata: ClassMetadata; filePath: string }[]>();

  // Helper: Analyze one file and update cache
  async function analyzeFile(filePath: string) {
    try {
      const fileContent = await Bun.file(filePath).text();
      const metas = parser.parse(filePath, fileContent);

      const cacheEntries = metas.map(meta => ({ metadata: meta, filePath: filePath }));
      fileCache.set(filePath, cacheEntries);
      return true;
    } catch (e) {
      console.error(`❌ Parse Error (${filePath}):`, e);
      return false;
    }
  }

  // Helper: Rebuild Manifest
  async function rebuild() {
    const allClasses = Array.from(fileCache.values()).flat();
    console.log(`🛠️  Rebuilding manifest (${allClasses.length} classes)...`);

    const manifestCode = manifestGen.generate(allClasses, outDir);
    await Bun.write(join(outDir, 'manifest.ts'), manifestCode);

    const indexContent = `
import { createContainer } from "./manifest";
console.log("🌟 Bunner App Started (Generated)");
const container = createContainer();
export { container };
`;
    if (!(await Bun.file(join(outDir, 'index.ts')).exists())) {
      await Bun.write(join(outDir, 'index.ts'), indexContent);
    }
  }

  // 3. Initial Scan
  const glob = new Glob('**/*.ts');
  console.log('🔍 Initial Scan...');
  for await (const file of glob.scan(srcDir)) {
    await analyzeFile(join(srcDir, file));
  }
  await rebuild();

  // 4. Spawn Child App
  const appEntry = join(outDir, 'index.ts');
  console.log(`🚀 Spawning App: bun run --watch ${appEntry}`);

  const appProc = Bun.spawn(['bun', 'run', '--watch', appEntry], {
    stdout: 'inherit',
    stderr: 'inherit',
    env: { ...process.env, FORCE_COLOR: '1' },
  });

  // 5. Watcher
  console.log(`👀 Watching ${srcDir} for changes...`);
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  const watcher = watch(srcDir, { recursive: true }, async (_event, filename) => {
    if (!filename || !filename.endsWith('.ts')) {
      return;
    }

    const fullPath = join(srcDir, filename);
    console.log(`🔄 Syncing: ${filename}`);

    if (!(await Bun.file(fullPath).exists())) {
      fileCache.delete(fullPath);
    } else {
      await analyzeFile(fullPath);
    }

    await rebuild();
  });

  process.on('SIGINT', () => {
    watcher.close();
    appProc.kill();
    process.exit(0);
  });
}
