import { describe, expect, it } from 'bun:test';

import { parseSource } from './oxc-wrapper';
import { collectVariables } from './variable-collector';

const getFunctionBodyStatement = (sourceText: string, statementIndex: number): unknown => {
  const parsed = parseSource('/virtual/variable-collector.spec.ts', sourceText);
  const program = parsed.program;

  if (!program || typeof program !== 'object') {
    throw new Error('Expected program object');
  }

  const body = (program as Record<string, unknown>)['body'];

  if (!Array.isArray(body) || body.length === 0) {
    throw new Error('Expected program body array');
  }

  const functionDecl = body[0];

  if (!functionDecl || typeof functionDecl !== 'object') {
    throw new Error('Expected function decl object');
  }

  const functionBody = (functionDecl as Record<string, unknown>)['body'];

  if (!functionBody || typeof functionBody !== 'object') {
    throw new Error('Expected function body object');
  }

  const statements = (functionBody as Record<string, unknown>)['body'];

  if (!Array.isArray(statements) || statements.length === 0) {
    throw new Error('Expected function body statements');
  }

  const picked = statements[statementIndex];

  if (!picked) {
    throw new Error('Expected statement at index');
  }

  return picked;
};

describe('collectVariables', () => {
  it('does not count reads in a statically never-executed && branch', () => {
    const statement = getFunctionBodyStatement(['function f() {', '  let value = 1;', '  false && value;', '}'].join('\n'), 1);
    const usages = collectVariables(statement, { includeNestedFunctions: false });
    const valueReads = usages.filter(usage => usage.name === 'value' && usage.isRead);

    expect(valueReads.length).toBe(0);
  });

  it('does not count reads in a statically unreachable conditional branch', () => {
    const statement = getFunctionBodyStatement(['function f() {', '  let value = 1;', '  true ? 0 : value;', '}'].join('\n'), 1);
    const usages = collectVariables(statement, { includeNestedFunctions: false });
    const valueReads = usages.filter(usage => usage.name === 'value' && usage.isRead);

    expect(valueReads.length).toBe(0);
  });

  it('counts reads inside an immediately-invoked function expression', () => {
    const statement = getFunctionBodyStatement(['function f() {', '  let value = 1;', '  (() => value)();', '}'].join('\n'), 1);
    const usages = collectVariables(statement, { includeNestedFunctions: false });
    const valueReads = usages.filter(usage => usage.name === 'value' && usage.isRead);

    expect(valueReads.length).toBeGreaterThan(0);
  });

  it('does not count destructuring default reads when the property is statically present', () => {
    const statement = getFunctionBodyStatement(
      ['function f() {', '  let value = 1;', '  let { a = value } = { a: 2 };', '}'].join('\n'),
      1,
    );
    const usages = collectVariables(statement, { includeNestedFunctions: false });
    const valueReads = usages.filter(usage => usage.name === 'value' && usage.isRead);

    expect(valueReads.length).toBe(0);
  });

  it('counts destructuring default reads when the property is statically missing', () => {
    const statement = getFunctionBodyStatement(
      ['function f() {', '  let value = 1;', '  let { a = value } = {};', '}'].join('\n'),
      1,
    );
    const usages = collectVariables(statement, { includeNestedFunctions: false });
    const valueReads = usages.filter(usage => usage.name === 'value' && usage.isRead);

    expect(valueReads.length).toBeGreaterThan(0);
  });
});
