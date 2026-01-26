import { describe, expect, it } from 'bun:test';

import { EntryGenerator } from './entry';

describe('entry', () => {
  it('should inline bootstrap when workers is 1', () => {
    // Arrange
    const gen = new EntryGenerator();
    // Act
    const code = gen.generate('./src/main.ts', false, { workers: 1 });

    // Assert
    expect(code).toContain('if (workersCount <= 1)');
    expect(code).toContain('await bootstrap();');
    expect(code).toContain("const runtimeFileName = './runtime.js'");
    expect(code).toContain('await import(runtimeFileName)');
    expect(code).toContain('new ClusterManager');
  });

  it('should use ClusterManager when workers is greater than 1', () => {
    // Arrange
    const gen = new EntryGenerator();
    // Act
    const code = gen.generate('./src/main.ts', false, { workers: 2 });

    // Assert
    expect(code).toContain('if (workersCount <= 1)');
    expect(code).toContain('new ClusterManager');
  });
});
