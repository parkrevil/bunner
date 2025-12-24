import { join, resolve, dirname } from 'path';

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

  const fileMap = new Map<string, any>(); // Map<string, FileAnalysis>
  const allClasses: { metadata: ClassMetadata; filePath: string }[] = [];

  logger.info('🔍 Scanning source files...');

  const userMain = join(srcDir, 'main.ts');
  const visited = new Set<string>();
  const queue: string[] = [userMain];

  const glob = new Glob('**/*.ts');
  for await (const file of glob.scan(srcDir)) {
    const fullPath = join(srcDir, file);
    if (fullPath !== userMain) {
      queue.push(fullPath);
    }
  }

  while (queue.length > 0) {
    const filePath = queue.shift()!;
    if (visited.has(filePath)) {
      continue;
    }
    visited.add(filePath);

    // Filter: Only scan .ts files, ignore .d.ts
    if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx')) {
      continue;
    }
    if (filePath.endsWith('.d.ts')) {
      continue;
    }

    try {
      const fileContent = await Bun.file(filePath).text();
      console.log('Scanning:', filePath);
      const parseResult = parser.parse(filePath, fileContent);

      const classInfos = parseResult.classes.map(meta => ({ metadata: meta, filePath }));
      allClasses.push(...classInfos);

      fileMap.set(filePath, {
        filePath,
        classes: classInfos,
        reExports: parseResult.reExports,
        exports: parseResult.exports,
      });

      // Follow Imports
      // Follow Imports
      // Follow Imports & Re-Exports
      const pathsToFollow = new Set<string>();

      if (parseResult.imports) {
        Object.values(parseResult.imports).forEach(p => pathsToFollow.add(p));
      }
      if (parseResult.reExports) {
        parseResult.reExports.forEach(re => pathsToFollow.add(re.module));
      }

      for (const rawImportPath of pathsToFollow) {
        let resolvedPath = rawImportPath;

        // If not absolute, try to resolve via Bun
        if (!resolvedPath.startsWith('/') && !resolvedPath.match(/^[a-zA-Z]:/)) {
          try {
            resolvedPath = Bun.resolveSync(resolvedPath, dirname(filePath));
          } catch (_e) {
            // console.warn(`Failed to resolve import: ${rawImportPath} from ${filePath}`);
            continue; // Skip if unresolved
          }
        }

        // Handle missing extensions
        if (resolvedPath && !resolvedPath.endsWith('.ts') && !resolvedPath.endsWith('.tsx') && !resolvedPath.endsWith('.d.ts')) {
          if (await Bun.file(resolvedPath + '.ts').exists()) {
            resolvedPath += '.ts';
          } else if (await Bun.file(resolvedPath + '.tsx').exists()) {
            resolvedPath += '.tsx';
          } else if (await Bun.file(resolvedPath + '/index.ts').exists()) {
            resolvedPath += '/index.ts';
          }
        }

        if (resolvedPath && !visited.has(resolvedPath)) {
          // Allow scanning .ts/.tsx files.
          if (
            !resolvedPath.endsWith('.d.ts') &&
            (resolvedPath.endsWith('.ts') || resolvedPath.endsWith('.tsx')) &&
            !resolvedPath.includes('/node_modules/@types/') // Exclude type definitions
          ) {
            queue.push(resolvedPath);
          }
        }
      }
    } catch (_e) {
      // logger.warn(`⚠️ Failed to parse ${filePath}: ${e.message}`);
    }
  }

  logger.info('🕸️  Building Module Graph...');
  const graph = new ModuleGraph(fileMap);
  graph.build();

  logger.info('🛠️  Generating intermediate manifests...');
  const manifestFile = join(bunnerDir, 'manifest.ts');
  const manifestCode = manifestGen.generate(graph, allClasses, bunnerDir);
  await Bun.write(manifestFile, manifestCode);

  const entryPointFile = join(bunnerDir, 'entry.ts');
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
