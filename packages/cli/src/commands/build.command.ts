import { join, resolve } from 'path';

import { Logger } from '@bunner/logger';
import { Glob } from 'bun';

import { AstParser, ModuleGraph, type ClassMetadata } from '../analyzer';
import { ConfigLoader } from '../common';
import { EntryGenerator, ManifestGenerator } from '../generator';

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
  const fileMap = new Map<string, any>(); // Map<string, FileAnalysis>
  const allClasses: { metadata: ClassMetadata; filePath: string }[] = [];

  logger.info('🔍 Scanning source files...');
  for await (const file of glob.scan(srcDir)) {
    const fullPath = join(srcDir, file);
    try {
      const fileContent = await Bun.file(fullPath).text();
      const parseResult = parser.parse(fullPath, fileContent);

      const classInfos = parseResult.classes.map(meta => ({ metadata: meta, filePath: fullPath }));
      allClasses.push(...classInfos);

      fileMap.set(fullPath, {
        filePath: fullPath,
        classes: classInfos, // Use ClassInfo[]
        reExports: parseResult.reExports,
        exports: parseResult.exports,
      });
    } catch (e) {
      logger.error(`⚠️ Failed to parse ${file}:`, e);
    }
  }

  logger.info('🕸️  Building Module Graph...');
  const graph = new ModuleGraph(fileMap); // Pass fileMap
  graph.build();

  logger.info('🛠️  Generating intermediate manifests...');
  const manifestFile = join(bunnerDir, 'manifest.ts');
  const manifestCode = manifestGen.generate(graph, allClasses, bunnerDir);
  await Bun.write(manifestFile, manifestCode);

  const entryPointFile = join(bunnerDir, 'entry.ts');
  const userMain = join(srcDir, 'main.ts');
  const entryGen = new EntryGenerator();

  const buildEntryContent = entryGen.generate(userMain, false, config);
  await Bun.write(entryPointFile, buildEntryContent);

  logger.info('📦 Bundling application, manifest, and workers...');

  let workerFiles: string[] = [];
  if (Array.isArray(config.workers)) {
    workerFiles = config.workers.map(w => resolve(projectRoot, w));
  }

  if (workerFiles.length > 0) {
    workerFiles.forEach((w: string) => logger.info(`   Worker Entry: ${w}`));
  }

  const buildResult = await Bun.build({
    entrypoints: [entryPointFile, manifestFile, ...workerFiles],
    outdir: outDir,
    target: 'bun',
    minify: false,
    sourcemap: 'external',
    naming: '[name].js',
  });

  if (!buildResult.success) {
    logger.error('❌ Build failed!');
    for (const log of buildResult.logs) {
      logger.error(log.message, log);
    }
    process.exit(1);
  }

  logger.info('✅ Build Complete!');
  logger.info(`   Entry: ${join(outDir, 'entry.js')}`);
  if (workerFiles.length > 0) {
    workerFiles.forEach(w => {
      const workerName = w.split('/').pop()?.replace('.ts', '.js');
      logger.info(`   Worker: ${join(outDir, workerName || '')}`);
    });
  }
  logger.info(`   Manifest: ${join(outDir, 'manifest.js')}`);
}
