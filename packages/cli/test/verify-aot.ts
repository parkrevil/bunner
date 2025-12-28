import { resolve, join } from 'path';

import { Glob } from 'bun';

import { AstParser } from '../src/analyzer/ast-parser';
import type { FileAnalysis } from '../src/analyzer/graph/interfaces';
import { ModuleGraph } from '../src/analyzer/graph/module-graph';
import { ImportRegistry } from '../src/generator/import-registry';
import { InjectorGenerator } from '../src/generator/injector';

async function run() {
  const appDir = resolve(__dirname, '../../../examples/src');

  console.log('Verifying app at:', appDir);

  const glob = new Glob('**/*.ts');
  const files: string[] = [];

  for await (const file of glob.scan(appDir)) {
    files.push(join(appDir, file));
  }

  console.log(`Found ${files.length} files.`);

  const parser = new AstParser();
  const fileMap = new Map<string, FileAnalysis>();

  console.log('Parsing files...');

  for (const file of files) {
    const code = await Bun.file(file).text();
    const result = parser.parse(file, code);

    fileMap.set(file, {
      filePath: file,
      ...result,
    });
  }

  console.log('Building Module Graph...');

  const graph = new ModuleGraph(fileMap);

  try {
    const modules = graph.build();

    console.log(`Graph built successfully. Found ${modules.size} modules.`);

    modules.forEach(node => {
      console.log(`- Module: ${node.name} (${node.providers.size} providers, ${node.dynamicProviderBundles.size} bundles)`);

      if (node.dynamicProviderBundles.size > 0) {
        console.log('  Has dynamic bundles!');
      }

      if (node.moduleDefinition && node.moduleDefinition.adapters) {
        console.log('  Has Adapters:', JSON.stringify(node.moduleDefinition.adapters, null, 2));
      }
    });

    const registry = new ImportRegistry(appDir);
    const generator = new InjectorGenerator();

    console.log('Generating Code...');

    const code = generator.generate(graph, registry);

    console.log('Generated Code Length:', code.length);
    console.log('--- GENERATED CODE START ---');
    console.log(code);
    console.log('--- GENERATED CODE END ---');
  } catch (e: any) {
    console.error('AOT Validation Failed:', e.message);

    process.exit(1);
  }
}

void run();
