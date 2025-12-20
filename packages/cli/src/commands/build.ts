import { join, resolve } from 'path';

import { Glob } from 'bun';

import { AstParser, type ClassMetadata } from '../analyzer/ast-parser';
import { ModuleGraph } from '../analyzer/graph/module-graph';
import { ManifestGenerator } from '../generators/manifest';
import { ConfigLoader } from '../utils/config-loader';

export async function build() {
  console.log('🚀 Starting Bunner Production Build...');

  // 1. Load Config
  await ConfigLoader.load();
  const projectRoot = process.cwd();
  const srcDir = resolve(projectRoot, 'src');
  const outDir = resolve(projectRoot, 'dist');
  const bunnerDir = resolve(projectRoot, '.bunner');

  console.log(`📂 Project Root: ${projectRoot}`);
  console.log(`📂 Source Dir: ${srcDir}`);
  console.log(`📂 Output Dir: ${outDir}`);

  // 2. Initialize Components
  // const _scanner = new SourceScanner();
  const parser = new AstParser();
  const manifestGen = new ManifestGenerator();

  // 3. Scan & Analyze
  const glob = new Glob('**/*.ts');
  const classes: { metadata: ClassMetadata; filePath: string }[] = [];

  console.log('🔍 Scanning source files...');
  for await (const file of glob.scan(srcDir)) {
    const fullPath = join(srcDir, file);
    try {
      const fileContent = await Bun.file(fullPath).text();
      const metas = parser.parse(fullPath, fileContent);

      metas.forEach(meta => {
        classes.push({ metadata: meta, filePath: fullPath });
      });
    } catch (e) {
      console.error(`⚠️ Failed to parse ${file}:`, e);
    }
  }

  // 4. Build Module Graph
  console.log('🕸️  Building Module Graph...');
  const graph = new ModuleGraph(classes);
  graph.build();

  // 5. Generate Manifests (Intermediate)
  console.log('🛠️  Generating intermediate manifests...');
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

  // 7. Bun Build (Bundling)
  console.log('📦 Bundling application, manifest, and workers...');

  const workerSrc = resolve(projectRoot, 'node_modules/@bunner/http-server/src/bunner-http-worker.ts');

  const result = await Bun.build({
    entrypoints: [entryPointFile, workerSrc, manifestFile],
    outdir: outDir,
    target: 'bun',
    minify: true,
    sourcemap: 'external',
    naming: '[name].js',
  });

  if (!result.success) {
    console.error('❌ Build Failed:');
    for (const msg of result.logs) {
      console.error(msg);
    }
    process.exit(1);
  }

  console.log('✅ Build Complete!');
  console.log(`   Entry: ${join(outDir, 'entry.js')}`);
  console.log(`   Worker: ${join(outDir, 'bunner-http-worker.js')}`);
  console.log(`   Manifest: ${join(outDir, 'manifest.js')}`);
}
