import { AstParser } from './packages/cli/src/analyzer/ast-parser';
import { ModuleGraph, ClassInfo } from './packages/cli/src/analyzer/graph/module-graph';

const moduleXCode = `
import { Module } from '@bunner/common';
// import { ModuleY } from './module-y';

@Module({
  imports: [ModuleY], // Circular!
})
export class ModuleX {}
`;

const moduleYCode = `
import { Module } from '@bunner/common';
// import { ModuleX } from './module-x';

@Module({
  imports: [ModuleX], // Circular!
})
export class ModuleY {}
`;

async function testPhase2() {
  await Promise.resolve();
  console.log('🧪 Starting Phase 2 Tests (Circular Dependency)...\n');

  const parser = new AstParser();
  // We mock the code content directly.
  // Note: AstParser does not resolve file imports on disk here, it just parses the string.
  // The 'imports: [ModuleY]' identifier will be picked up.
  // We need to ensure AstParser handles Identifier ref in 'imports'. (Yes, it does: { __bunner_ref: 'ModuleY' })

  const classX = parser.parse('module-x.ts', moduleXCode)[0];
  const classY = parser.parse('module-y.ts', moduleYCode)[0];

  const classInfos: ClassInfo[] = [
    { metadata: classX, filePath: 'module-x.ts' },
    { metadata: classY, filePath: 'module-y.ts' },
  ];

  const graph = new ModuleGraph(classInfos);
  graph.build();

  console.log('--- Detecting Cycles ---');
  const cycles = graph.detectCycles();

  if (cycles.length > 0) {
    console.log(`✅ Cycle Detected! Found ${cycles.length} cycle(s).`);
    cycles.forEach((c, i) => {
      console.log(`[Cycle ${i + 1}] Path: ${c.path.join(' -> ')}`);
      console.log(`[Fix Suggestion] ${c.suggestedFix}`);
    });
  } else {
    console.error('❌ No cycles detected (Expected 1).');
  }
}

testPhase2().catch(console.error);
