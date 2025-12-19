import { join, resolve } from 'path';

import { Glob } from 'bun';

import { AstParser, type ClassMetadata } from '../analyzer/ast-parser';
import { SourceScanner } from '../analyzer/source-scanner';
import { ManifestGenerator } from '../generators/manifest';
import { ConfigLoader } from '../utils/config-loader';

export async function build() {
  console.log('🚀 Starting Bunner Production Build...');

  // 1. Load Config
  const _config = await ConfigLoader.load();
  const projectRoot = process.cwd();
  const srcDir = resolve(projectRoot, 'src');
  const outDir = resolve(projectRoot, 'dist');
  const bunnerDir = resolve(projectRoot, '.bunner');

  console.log(`📂 Project Root: ${projectRoot}`);
  console.log(`📂 Source Dir: ${srcDir}`);
  console.log(`📂 Output Dir: ${outDir}`);

  // 2. Initialize Components

  const _scanner = new SourceScanner();
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

  // 4. Generate Manifests (Intermediate)
  console.log('🛠️  Generating intermediate manifests...');
  // Ensure .bunner exists for intermediate files
  // We use .bunner as a staging area before bundling
  const manifestCode = manifestGen.generate(classes, bunnerDir);
  await Bun.write(join(bunnerDir, 'manifest.ts'), manifestCode);

  const indexContent = `
import { createContainer, createMetadataRegistry } from "./manifest";

// For production, we don't rely on dynamic paths for workers as much, 
// but we still need to set up the global environment.
globalThis.__BUNNER_MANIFEST_PATH__ = import.meta.resolve("./manifest.ts"); // Check if this works in bundled env
const container = createContainer();
const metadata = createMetadataRegistry();
globalThis.__BUNNER_CONTAINER__ = container;
globalThis.__BUNNER_METADATA_REGISTRY__ = metadata;

export { container, metadata };
`;
  await Bun.write(join(bunnerDir, 'index.ts'), indexContent);

  // 5. Bun Build (Bundling)
  console.log('📦 Bundling application...');

  const entryPoint = join(bunnerDir, 'entry.ts');
  const userMain = join(srcDir, 'main.ts');

  // We don't need relative path calculation if we use absolute path in import.
  // Bun handles absolute imports in bundling.

  const buildEntryContent = `
// 1. Initialize AOT Environment
import { container, metadata } from "./index";

// 2. Execute User Application
import "${userMain}";
`;
  await Bun.write(entryPoint, buildEntryContent);

  const result = await Bun.build({
    entrypoints: [entryPoint],
    outdir: outDir,
    target: 'bun',
    minify: true,
    sourcemap: 'external',
  });

  if (!result.success) {
    console.error('❌ Build Failed:');
    for (const msg of result.logs) {
      console.error(msg);
    }
    process.exit(1);
  }

  console.log('✅ Build Complete!');
  console.log(`   Output: ${join(outDir, 'entry.js')}`);
}
