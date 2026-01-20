import { join, resolve, dirname } from 'path';

import { Glob } from 'bun';

import { AstParser, ModuleGraph, type FileAnalysis } from '../analyzer';
import { ConfigLoader, ConfigLoadError, compareCodePoint, scanGlobSorted, writeIfChanged } from '../common';
import { buildDiagnostic, reportDiagnostics } from '../diagnostics';
import { EntryGenerator, ManifestGenerator } from '../generator';

import type { CollectedClass } from './types';

export async function build() {
  console.info('🚀 Starting Bunner Production Build...');

  try {
    const configResult = await ConfigLoader.load();
    const config = configResult.config;
    const moduleFileName = config.module.fileName;
    const buildProfile = config.compiler?.profile ?? 'full';
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
    const allClasses: CollectedClass[] = [];

    console.info('🔍 Scanning source files...');

    const userMain = join(srcDir, config.entry ?? 'main.ts');
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

          if (
            resolvedPath &&
            !resolvedPath.endsWith('.ts') &&
            !resolvedPath.endsWith('.tsx') &&
            !resolvedPath.endsWith('.d.ts')
          ) {
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

    const graph = new ModuleGraph(fileMap, moduleFileName);

    graph.build();

    console.info('🛠️  Generating intermediate manifests...');

    const manifestFile = join(bunnerDir, 'manifest.json');
    const manifestJson = manifestGen.generateJson({
      graph,
      projectRoot,
      source: configResult.source,
      resolvedConfig: config,
    });

    await writeIfChanged(manifestFile, manifestJson);

    const runtimeFile = join(bunnerDir, 'runtime.ts');
    const runtimeCode = manifestGen.generate(graph, allClasses, bunnerDir);

    await writeIfChanged(runtimeFile, runtimeCode);

    const entryPointFile = join(bunnerDir, 'entry.ts');
    const entryGen = new EntryGenerator();
    const buildEntryContent = entryGen.generate(userMain, false, { workers: config.workers });

    await writeIfChanged(entryPointFile, buildEntryContent);

    const manifestJsonGuard = manifestGen.generateJson({
      graph,
      projectRoot,
      source: configResult.source,
      resolvedConfig: config,
    });

    if (manifestJsonGuard !== manifestJson) {
      throw new Error('Manifest output is not deterministic for the current build inputs.');
    }

    if (!['minimal', 'standard', 'full'].includes(buildProfile)) {
      throw new Error(`Invalid build profile: ${buildProfile}`);
    }

    if (buildProfile === 'standard' || buildProfile === 'full') {
      const interfaceCatalogFile = join(bunnerDir, 'interface-catalog.json');
      const interfaceCatalogJson = JSON.stringify({ schemaVersion: '1', entries: [] }, null, 2);

      await writeIfChanged(interfaceCatalogFile, interfaceCatalogJson);
    }

    if (buildProfile === 'full') {
      const runtimeReportFile = join(bunnerDir, 'runtime-report.json');
      const runtimeReportJson = JSON.stringify({ schemaVersion: '1', adapters: [] }, null, 2);

      await writeIfChanged(runtimeReportFile, runtimeReportJson);
    }

    console.info('📦 Bundling application, manifest, and workers...');

    let workerFiles: string[] = [];

    if (Array.isArray(config.workers)) {
      workerFiles = config.workers.map(w => resolve(projectRoot, w));
    }

    if (workerFiles.length > 0) {
      workerFiles.forEach((w: string) => console.info(`   Worker Entry: ${w}`));
    }

    const buildResult = await Bun.build({
      entrypoints: [entryPointFile, runtimeFile, ...workerFiles],
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

    console.info(`   Runtime: ${join(outDir, 'runtime.js')}`);
    console.info(`   Manifest: ${manifestFile}`);
  } catch (error) {
    const file = error instanceof ConfigLoadError && error.sourcePath ? error.sourcePath : '.';
    const reason = error instanceof Error ? error.message : 'Unknown build error.';
    const diagnostic = buildDiagnostic({
      code: 'BUILD_FAILED',
      severity: 'fatal',
      summary: 'Build failed.',
      reason,
      file,
    });

    reportDiagnostics({ diagnostics: [diagnostic] });
    throw error;
  }
}
