import { join, resolve, dirname } from 'path';

import { Glob } from 'bun';

import { AstParser, ModuleGraph, type ClassMetadata, type FileAnalysis } from '../analyzer';
import { ConfigLoader, compareCodePoint, scanGlobSorted } from '../common';
import { EntryGenerator, ManifestGenerator } from '../generator';

export async function build() {
  console.info('🚀 Starting Bunner Production Build...');

  const config = await ConfigLoader.load();
  const projectRoot = process.cwd();
  const srcDir = resolve(projectRoot, 'src');
  const outDir = resolve(projectRoot, 'dist');
  const bunnerDir = resolve(projectRoot, '.bunner');

  console.info(`📂 Project Root: ${projectRoot}`);
  console.info(`📂 Source Dir: ${srcDir}`);
  console.info(`📂 Output Dir: ${outDir}`);

  const parser = new AstParser();
  const manifestGen = new ManifestGenerator();
  const fileMap = new Map<string, FileAnalysis>();
  const allClasses: { metadata: ClassMetadata; filePath: string }[] = [];

  console.info('🔍 Scanning source files...');

  const userMain = join(srcDir, 'main.ts');
  const visited = new Set<string>();
  const queue: string[] = [userMain];
  const glob = new Glob('**/*.ts');
  const srcFiles = await scanGlobSorted({ glob, baseDir: srcDir });

  for (const file of srcFiles) {
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

    if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx')) {
      continue;
    }

    if (filePath.endsWith('.d.ts')) {
      continue;
    }

    try {
      const fileContent = await Bun.file(filePath).text();
      const parseResult = parser.parse(filePath, fileContent);
      const classInfos = parseResult.classes.map(meta => ({ metadata: meta, filePath }));

      allClasses.push(...classInfos);
      fileMap.set(filePath, {
        filePath,
        classes: parseResult.classes,
        reExports: parseResult.reExports,
        exports: parseResult.exports,
        imports: parseResult.imports,
        moduleDefinition: parseResult.moduleDefinition,
      });

      const pathsToFollow = new Set<string>();

      if (parseResult.imports) {
        Object.values(parseResult.imports).forEach(p => pathsToFollow.add(p));
      }

      if (parseResult.reExports) {
        parseResult.reExports.forEach(re => pathsToFollow.add(re.module));
      }

      const orderedPathsToFollow = Array.from(pathsToFollow).sort(compareCodePoint);

      for (const rawImportPath of orderedPathsToFollow) {
        let resolvedPath = rawImportPath;

        if (!resolvedPath.startsWith('/') && !resolvedPath.match(/^[a-zA-Z]:/)) {
          try {
            resolvedPath = Bun.resolveSync(resolvedPath, dirname(filePath));
          } catch (_e) {
            continue;
          }
        }

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
          if (
            !resolvedPath.endsWith('.d.ts') &&
            (resolvedPath.endsWith('.ts') || resolvedPath.endsWith('.tsx')) &&
            !resolvedPath.includes('/node_modules/@types/')
          ) {
            queue.push(resolvedPath);
          }
        }
      }
    } catch (_e) {}
  }

  console.info('🕸️  Building Module Graph...');

  const graph = new ModuleGraph(fileMap);

  graph.build();

  console.info('🛠️  Generating intermediate manifests...');

  const manifestFile = join(bunnerDir, 'manifest.ts');
  const manifestCode = manifestGen.generate(graph, allClasses, bunnerDir);

  await Bun.write(manifestFile, manifestCode);

  const entryPointFile = join(bunnerDir, 'entry.ts');
  const entryGen = new EntryGenerator();
  const buildEntryContent = entryGen.generate(userMain, false, { workers: config.workers });

  await Bun.write(entryPointFile, buildEntryContent);

  console.info('📦 Bundling application, manifest, and workers...');

  let workerFiles: string[] = [];

  if (Array.isArray(config.workers)) {
    workerFiles = config.workers.map(w => resolve(projectRoot, w));
  }

  if (workerFiles.length > 0) {
    workerFiles.forEach((w: string) => console.info(`   Worker Entry: ${w}`));
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
    console.error('❌ Build failed!');

    for (const log of buildResult.logs) {
      console.error(log.message, log);
    }

    throw new Error('Build failed');
  }

  console.info('✅ Build Complete!');
  console.info(`   Entry: ${join(outDir, 'entry.js')}`);

  if (workerFiles.length > 0) {
    workerFiles.forEach(w => {
      const workerName = w.split('/').pop()?.replace('.ts', '.js');

      console.info(`   Worker: ${join(outDir, workerName || '')}`);
    });
  }

  console.info(`   Manifest: ${join(outDir, 'manifest.js')}`);
}
