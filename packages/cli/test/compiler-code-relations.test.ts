import { describe, it, expect } from 'bun:test';
import { parseSync } from 'oxc-parser';
import { join } from 'path';

import { CallsExtractor } from '../src/compiler/extractors/calls.extractor';
import { ExtendsExtractor } from '../src/compiler/extractors/extends.extractor';
import { ImplementsExtractor } from '../src/compiler/extractors/implements.extractor';
import { ImportsExtractor } from '../src/compiler/extractors/imports.extractor';

function parse(filePath: string, code: string) {
  return parseSync(filePath, code).program;
}

function meta(metaJson: string | undefined): Record<string, unknown> | null {
  if (!metaJson) return null;
  return JSON.parse(metaJson) as Record<string, unknown>;
}

describe('compiler extractors integration', () => {
  it('should extract imports/extends/implements/calls across a small module set', () => {
    const aPath = join(process.cwd(), 'src', 'a.ts');
    const aCode = `
      import * as NS from './lib';
      import type { T } from './types';
      export type { X } from './x';

      function local() {}

      class C extends NS.Base implements NS.IFace {
        run() {
          NS.util();
          local();
        }
      }

      const main = () => {
        NS.util();
        new NS.Base();
      };

      async function dyn() {
        await import('./dyn');
      }
    `;

    const ast = parse(aPath, aCode);

    const imports = ImportsExtractor.extract(ast, aPath);
    const extendsRels = ExtendsExtractor.extract(ast, aPath);
    const implementsRels = ImplementsExtractor.extract(ast, aPath);
    const calls = CallsExtractor.extract(ast, aPath);

    // imports
    expect(imports.some((r) => r.dstEntityKey === 'module:src/lib.ts')).toBe(true);
    expect(imports.some((r) => r.dstEntityKey === 'module:src/types.ts' && meta(r.metaJson)?.isType === true)).toBe(true);
    expect(
      imports.some((r) => {
        const m = meta(r.metaJson);
        return r.dstEntityKey === 'module:src/x.ts' && m?.isReExport === true && m?.isType === true;
      }),
    ).toBe(true);
    expect(imports.some((r) => r.dstEntityKey === 'module:src/dyn.ts' && meta(r.metaJson)?.isDynamic === true)).toBe(true);

    // extends/implements from namespace
    expect(
      extendsRels.some((r) => r.srcEntityKey === 'symbol:src/a.ts#C' && r.dstEntityKey === 'symbol:src/lib.ts#Base'),
    ).toBe(true);
    expect(
      implementsRels.some((r) => r.srcEntityKey === 'symbol:src/a.ts#C' && r.dstEntityKey === 'symbol:src/lib.ts#IFace'),
    ).toBe(true);

    // calls: NS.util from method and from arrow function, local(), new NS.Base()
    expect(calls.some((r) => r.srcEntityKey === 'symbol:src/a.ts#C.run' && r.dstEntityKey === 'symbol:src/lib.ts#util')).toBe(true);
    expect(calls.some((r) => r.srcEntityKey === 'symbol:src/a.ts#main' && r.dstEntityKey === 'symbol:src/lib.ts#util')).toBe(true);
    expect(calls.some((r) => r.srcEntityKey === 'symbol:src/a.ts#C.run' && r.dstEntityKey === 'symbol:src/a.ts#local')).toBe(true);

    const ctorCall = calls.find((r) => r.dstEntityKey === 'symbol:src/lib.ts#Base' && r.srcEntityKey === 'symbol:src/a.ts#main');
    expect(ctorCall).toBeTruthy();
    expect(meta(ctorCall?.metaJson)?.isNew).toBe(true);
  });
});
