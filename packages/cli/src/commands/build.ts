import { join, resolve } from 'path';

import { Logger } from '@bunner/logger';
import { Glob } from 'bun';

import { AstParser, type ClassMetadata } from '../analyzer/ast-parser';
import { ModuleGraph } from '../analyzer/graph/module-graph';
import { ManifestGenerator } from '../generators/manifest';
import { ConfigLoader } from '../utils/config-loader';

export async function build() {
  const logger = new Logger('CLI:Build');
  logger.info('🚀 Starting Bunner Production Build...');

  // 1. Load Config
  await ConfigLoader.load();
  const projectRoot = process.cwd();
  const srcDir = resolve(projectRoot, 'src');
  const outDir = resolve(projectRoot, 'dist');
  const bunnerDir = resolve(projectRoot, '.bunner');

  logger.info(`📂 Project Root: ${projectRoot}`);
  logger.info(`📂 Source Dir: ${srcDir}`);
  logger.info(`📂 Output Dir: ${outDir}`);

  // 2. Initialize Components
  // const _scanner = new SourceScanner();
  const parser = new AstParser();
  const manifestGen = new ManifestGenerator();

  // 3. Scan & Analyze
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

  // 4. Build Module Graph
  logger.info('🕸️  Building Module Graph...');
  const graph = new ModuleGraph(classes);
  graph.build();

  // 5. Generate Manifests (Intermediate)
  logger.info('🛠️  Generating intermediate manifests...');
  const manifestFile = join(bunnerDir, 'manifest.ts');
  const manifestCode = manifestGen.generate(graph, classes, bunnerDir);
  await Bun.write(manifestFile, manifestCode);

  // 6. Setup Entry Point
  const entryPointFile = join(bunnerDir, 'entry.ts');
  const userMain = join(srcDir, 'main.ts');

  // We set globals BEFORE importing user code.
  // We use direct imports from manifest to ensure they are bundled.
  const buildEntryContent = `
import { createContainer, createMetadataRegistry, createScopedKeysMap } from "./manifest";

console.log("[Entry] Initializing AOT Globals...");
globalThis.__BUNNER_MANIFEST_PATH__ = import.meta.resolve("./manifest.js"); 
globalThis.__BUNNER_CONTAINER__ = createContainer();
globalThis.__BUNNER_METADATA_REGISTRY__ = createMetadataRegistry();
globalThis.__BUNNER_SCOPED_KEYS__ = createScopedKeysMap();

console.log("[Entry] Bootstrapping User Application...");
await import("${userMain}");
`;
  await Bun.write(entryPointFile, buildEntryContent);
  
  // Ensure Bun picks up the correct decorator settings for AOT files
  const bunnerTsConfig = join(bunnerDir, 'tsconfig.json');
  await Bun.write(bunnerTsConfig, JSON.stringify({
    extends: "../tsconfig.json",
    compilerOptions: {
      experimentalDecorators: false,
      emitDecoratorMetadata: false
    }
  }));

  // 7. Bun Build (Bundling)
  logger.info('📦 Bundling application, manifest, and workers...');

  const workerSrc = resolve(projectRoot, 'node_modules/@bunner/http-server/src/bunner-http-worker.ts');

  /*
  const buildCmd = [
    'bun', 'build',
    entryPointFile,
    workerSrc,
    manifestFile,
    `--outdir=${outDir}`,
    '--target=bun',
    '--naming=[name].js',
    '--sourcemap=external'
  ];

  const buildProc = Bun.spawnSync(buildCmd, {
    cwd: projectRoot,
    stdout: 'inherit',
    stderr: 'inherit',
  });

  if (!buildProc.success) {
    logger.error('❌ Build Failed');
    process.exit(1);
  }
  */

  const result = await Bun.build({
    entrypoints: [entryPointFile, workerSrc, manifestFile],
    outdir: outDir,
    target: 'bun',
    minify: false,
    sourcemap: 'external',
    naming: '[name].js',
    plugins: [{
      name: 'force-standard-decorators',
      setup(build) {
        const t = new Bun.Transpiler({
          loader: 'ts',
          target: 'bun',
          tsconfig: {
            compilerOptions: {
              experimentalDecorators: false,
              emitDecoratorMetadata: false
            }
          } as any
        });
        build.onLoad({ filter: /\.ts$/ }, async (args) => {
          const text = await Bun.file(args.path).text();
          return {
            contents: t.transformSync(text),
            loader: 'js',
          };
        });
      }
    }]
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
  logger.info(`   Worker: ${join(outDir, 'bunner-http-worker.js')}`);
  logger.info(`   Manifest: ${join(outDir, 'manifest.js')}`);
}
