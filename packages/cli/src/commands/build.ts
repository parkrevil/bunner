import { join, resolve } from 'path';

import { Logger } from '@bunner/logger';
import { Glob } from 'bun';

import { AstParser, type ClassMetadata } from '../analyzer/ast-parser';
import { ModuleGraph } from '../analyzer/graph/module-graph';
import { EntryGenerator } from '../generators/entry';
import { ManifestGenerator } from '../generators/manifest';
import { ConfigLoader } from '../utils/config-loader';

export async function build() {
  const logger = new Logger('CLI:Build');
  logger.info('🚀 Starting Bunner Production Build...');

  const config = await ConfigLoader.load();
  const projectRoot = process.cwd();
  const srcDir = resolve(projectRoot, 'src');
  const outDir = resolve(projectRoot, 'dist');
  const bunnerDir = resolve(projectRoot, '.bunner');

  logger.info(`📂 Project Root: ${projectRoot}`);
  logger.info(`📂 Source Dir: ${srcDir}`);
  logger.info(`📂 Output Dir: ${outDir}`);

  const parser = new AstParser();
  const manifestGen = new ManifestGenerator();

  const glob = new Glob('**/*.ts');
  const classes: { metadata: ClassMetadata; filePath: string }[] = [];

  logger.info('🔍 Scanning source files...');
  for await (const file of glob.scan(srcDir)) {
    const fullPath = join(srcDir, file);
    try {
      const fileContent = await Bun.file(fullPath).text();
      const metas = parser.parse(fullPath, fileContent);

      metas.forEach(meta => {
        classes.push({ metadata: meta, filePath: fullPath });
      });
    } catch (e) {
      logger.error(`⚠️ Failed to parse ${file}:`, e);
    }
  }

  logger.info('🕸️  Building Module Graph...');
  const graph = new ModuleGraph(classes);
  graph.build();

  logger.info('🛠️  Generating intermediate manifests...');
  const manifestFile = join(bunnerDir, 'manifest.ts');
  const manifestCode = manifestGen.generate(graph, classes, bunnerDir);
  await Bun.write(manifestFile, manifestCode);

  const entryPointFile = join(bunnerDir, 'entry.ts');
  const userMain = join(srcDir, 'main.ts');
  const entryGen = new EntryGenerator();

  const buildEntryContent = entryGen.generate(userMain, false);
  await Bun.write(entryPointFile, buildEntryContent);

  logger.info('📦 Bundling application, manifest, and workers...');

  const workers = config.workers?.map(w => resolve(projectRoot, w)) || [];

  if (workers.length > 0) {
    workers.forEach(w => logger.info(`   Worker Entry: ${w}`));
  }

  const result = await Bun.build({
    entrypoints: [entryPointFile, manifestFile, ...workers],
    outdir: outDir,
    target: 'bun',
    minify: false,
    sourcemap: 'external',
    naming: '[name].js',
  });

  if (!result.success) {
    logger.error('❌ Build Failed:');
    for (const log of result.logs) {
      logger.error(log.message, log);
    }
    process.exit(1);
  }

  logger.info('✅ Build Complete!');
  logger.info(`   Entry: ${join(outDir, 'entry.js')}`);
  if (workers.length > 0) {
    workers.forEach(w => {
      const workerName = w.split('/').pop()?.replace('.ts', '.js');
      logger.info(`   Worker: ${join(outDir, workerName || '')}`);
    });
  }
  logger.info(`   Manifest: ${join(outDir, 'manifest.js')}`);
}