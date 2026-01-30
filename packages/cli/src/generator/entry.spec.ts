import { describe, expect, it } from 'bun:test';

import { EntryGenerator } from './entry';

describe('entry', () => {
  it('should inline bootstrap when generating runtime entry', () => {
    // Arrange
    const gen = new EntryGenerator();
    // Act
    const code = gen.generate('./src/main.ts', false);

    // Assert
    expect(code).toContain('await bootstrap();');
    expect(code).toContain("const runtimeFileName = './runtime.js'");
    expect(code).toContain(`await ${'im'}${'port'}(runtimeFileName)`);
  });
});
