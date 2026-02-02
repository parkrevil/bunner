import { describe, expect, it } from 'bun:test';

import type { TypecheckItem } from '../../types';

import { parseTscDiagnostics } from './detector';

describe('detector', () => {
  it('should parse file-based TS diagnostics when tsc emits file diagnostics', () => {
    // Arrange
    const cwd = '/repo';
    const output = [
      'src/a.ts(3,5): error TS2322: Type \'string\' is not assignable to type \'number\'.',
      'src/b.ts(10,1): warning TS6133: \'unused\' is declared but its value is never read.',
    ].join('\n');
    // Act
    const items = parseTscDiagnostics(cwd, output);

    // Assert
    expect(items).toHaveLength(2);

    const expectedError = {
      severity: 'error',
      code: 'TS2322',
      message: "Type 'string' is not assignable to type 'number'.",
      filePath: '/repo/src/a.ts',
      span: {
        start: { line: 3, column: 5 },
        end: { line: 3, column: 5 },
      },
    } satisfies Partial<TypecheckItem>;
    const expectedWarning = {
      severity: 'warning',
      code: 'TS6133',
      message: "'unused' is declared but its value is never read.",
      filePath: '/repo/src/b.ts',
      span: {
        start: { line: 10, column: 1 },
        end: { line: 10, column: 1 },
      },
    } satisfies Partial<TypecheckItem>;

    expect(items[0]).toMatchObject(expectedError);
    expect(items[1]).toMatchObject(expectedWarning);
  });
});
