import { describe, expect, it } from 'bun:test';

import { ImportRegistry } from './import-registry';

describe('ImportRegistry.getImportStatements', () => {
  it('should be deterministic regardless of insertion order', () => {
    const registry1 = new ImportRegistry('/out');

    registry1.getAlias('BClass', './b.ts');
    registry1.getAlias('AClass', './a.ts');
    registry1.getAlias('CClass', '@bunner/core');

    const registry2 = new ImportRegistry('/out');

    registry2.getAlias('CClass', '@bunner/core');
    registry2.getAlias('AClass', './a.ts');
    registry2.getAlias('BClass', './b.ts');
    expect(registry1.getImportStatements()).toEqual(registry2.getImportStatements());
  });

  it('should sort imports by path then name then alias', () => {
    const registry = new ImportRegistry('/out');

    registry.getAlias('BClass', './b.ts');
    registry.getAlias('AClass', './a.ts');
    registry.getAlias('CoreThing', '@bunner/core');
    expect(registry.getImportStatements()).toEqual([
      'import { AClass } from "./a.ts";',
      'import { BClass } from "./b.ts";',
      'import { CoreThing } from "@bunner/core";',
    ]);
  });
});
