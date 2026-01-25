import { describe, expect, it } from 'bun:test';

import { EntryGenerator } from './entry';

describe('EntryGenerator.generate', () => {
  it('should inline bootstrap when workers is 1', () => {
    const gen = new EntryGenerator();
    const code = gen.generate('./src/main.ts', false, { workers: 1 });

    expect(code).toContain('if (workersCount <= 1)');
    expect(code).toContain('await bootstrap();');
    expect(code).toContain("const runtimeFileName = './runtime.js'");
    expect(code).toContain('await import(runtimeFileName)');
    expect(code).toContain('new ClusterManager');
  });

  it('should use ClusterManager when workers is greater than 1', () => {
    const gen = new EntryGenerator();
    const code = gen.generate('./src/main.ts', false, { workers: 2 });

    expect(code).toContain('if (workersCount <= 1)');
    expect(code).toContain('new ClusterManager');
  });
});
