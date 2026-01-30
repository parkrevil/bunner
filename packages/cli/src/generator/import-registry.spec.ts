import { describe, expect, it, mock } from 'bun:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const actualCommon = require('../common');

mock.module('../common', () => {
  return {
    ...actualCommon,
    PathResolver: actualCommon.PathResolver,
    compareCodePoint: (...args: unknown[]) => actualCommon.compareCodePoint(...args),
  };
});

const { ImportRegistry } = require('./import-registry');

describe('ImportRegistry', () => {
  it('should be deterministic when insertion order differs', () => {
    // Arrange
    const registry1 = new ImportRegistry('/out');

    registry1.getAlias('BClass', './b.ts');
    registry1.getAlias('AClass', './a.ts');
    registry1.getAlias('CClass', '@bunner/core');

    const registry2 = new ImportRegistry('/out');

    registry2.getAlias('CClass', '@bunner/core');
    registry2.getAlias('AClass', './a.ts');
    registry2.getAlias('BClass', './b.ts');

    // Act
    const statements1 = registry1.getImportStatements();
    const statements2 = registry2.getImportStatements();

    // Assert
    expect(statements1).toEqual(statements2);
  });

  it('should sort imports when entries are registered', () => {
    // Arrange
    const registry = new ImportRegistry('/out');

    registry.getAlias('BClass', './b.ts');
    registry.getAlias('AClass', './a.ts');
    registry.getAlias('CoreThing', '@bunner/core');

    // Act
    const statements = registry.getImportStatements();

    // Assert
    expect(statements).toEqual([
      'import { AClass } from "./a.ts";',
      'import { BClass } from "./b.ts";',
      'import { CoreThing } from "@bunner/core";',
    ]);
  });
});
