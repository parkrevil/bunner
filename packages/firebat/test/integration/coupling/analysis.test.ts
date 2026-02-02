import { describe, expect, it } from 'bun:test';

import { analyzeCoupling } from '../../../src/features/coupling';
import { analyzeDependencies } from '../../../src/features/dependency-graph';
import { createProgramFromMap } from '../shared/test-kit';

describe('integration/coupling', () => {
  it('should detect hotspots when dependency fan-in/out exists', () => {
    // Arrange
    let sources = new Map<string, string>();

    sources.set('/virtual/coupling/a.ts', `import './b';\nexport const alpha = 1;`);
    sources.set('/virtual/coupling/b.ts', `import './c';\nexport const beta = 2;`);
    sources.set('/virtual/coupling/c.ts', `import './a';\nexport const gamma = 3;`);

    // Act
    let program = createProgramFromMap(sources);
    let dependencies = analyzeDependencies(program);
    let coupling = analyzeCoupling(dependencies);

    // Assert
    expect(coupling.hotspots.length).toBeGreaterThan(0);
  });

  it('should return empty hotspots when dependencies are empty', () => {
    // Arrange
    let dependencies = analyzeDependencies([]);
    // Act
    let coupling = analyzeCoupling(dependencies);

    // Assert
    expect(coupling.hotspots.length).toBe(0);
  });

  it('should include fan-in signals when dependencies are shared', () => {
    // Arrange
    let sources = new Map<string, string>();

    sources.set('/virtual/coupling/a.ts', `import './shared';\nexport const alpha = 1;`);
    sources.set('/virtual/coupling/b.ts', `import './shared';\nexport const beta = 2;`);
    sources.set('/virtual/coupling/shared.ts', `export const shared = 3;`);

    // Act
    let program = createProgramFromMap(sources);
    let dependencies = analyzeDependencies(program);
    let coupling = analyzeCoupling(dependencies);
    let hotspot = coupling.hotspots.find(entry => entry.module.includes('shared'));

    // Assert
    expect(hotspot).toBeDefined();
    expect(hotspot?.signals.includes('fan-in')).toBe(true);
  });

  it('should sort hotspots by score then module name when tied', () => {
    // Arrange
    let sources = new Map<string, string>();

    sources.set('/virtual/coupling/a.ts', `import './x';\nexport const alpha = 1;`);
    sources.set('/virtual/coupling/b.ts', `import './y';\nexport const beta = 2;`);
    sources.set('/virtual/coupling/x.ts', `export const x = 3;`);
    sources.set('/virtual/coupling/y.ts', `export const y = 4;`);

    // Act
    let program = createProgramFromMap(sources);
    let dependencies = analyzeDependencies(program);
    let coupling = analyzeCoupling(dependencies);
    let names = coupling.hotspots.map(entry => entry.module);

    // Assert
    expect(names.length).toBeGreaterThanOrEqual(2);

    const sortedNames = [...names].sort((left, right) => left.localeCompare(right));

    expect(names[0]).toBe(sortedNames[0]);
  });
});
