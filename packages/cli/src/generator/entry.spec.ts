import { describe, expect, it } from 'bun:test';

import { EntryGenerator } from './entry';

describe('EntryGenerator.generate', () => {
  it('should inline bootstrap when workers is 1', () => {
    const gen = new EntryGenerator();
    const code = gen.generate('./src/main.ts', false, { workers: 1 });

    expect(code).toContain('if (workersCount <= 1)');
    expect(code).toContain('await bootstrap();');
    expect(code).toContain("new URL('./manifest.js', import.meta.url)");
    expect(code).toContain('__BUNNER_MANIFEST_PATH__');
    expect(code).toContain("await import('./manifest.js')");
    expect(code).toContain('new ClusterManager');
  });
  it('should use ClusterManager when workers is greater than 1', () => {
    const gen = new EntryGenerator();
    const code = gen.generate('./src/main.ts', false, { workers: 2 });

    expect(code).toContain('if (workersCount <= 1)');
    expect(code).toContain('new ClusterManager');
  });
});
