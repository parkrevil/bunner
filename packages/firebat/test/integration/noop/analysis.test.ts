import { describe, expect, it } from 'bun:test';

import { analyzeNoop } from '../../../src/features/noop';
import { createProgramFromMap } from '../shared/test-kit';

function createNoopSource(): string {
  return [
    'export function noopCase() {',
    '  1;',
    '  if (true) {',
    '    return 0;',
    '  }',
    '  return 1;',
    '}',
  ].join('\n');
}

function createSafeSource(): string {
  return [
    'export function safeCase(value) {',
    '  console.log(1);',
    '  if (value) {',
    '    return value;',
    '  }',
    '  return 0;',
    '}',
  ].join('\n');
}

function createObjectNoopSource(): string {
  return [
    'export function objectNoop() {',
    '  ({ value: 1 });',
    '  [1, 2, 3];',
    '  (() => 1);',
    '  return 0;',
    '}',
  ].join('\n');
}

describe('integration/noop', () => {
  it('should report expression noops when statements have no effects', () => {
    // Arrange
    let sources = new Map<string, string>();

    sources.set('/virtual/noop/noop.ts', createNoopSource());

    // Act
    let program = createProgramFromMap(sources);
    let analysis = analyzeNoop(program);
    let hasExpressionNoop = analysis.findings.some(finding => finding.kind === 'expression-noop');
    let hasConstantCondition = analysis.findings.some(finding => finding.kind === 'constant-condition');

    // Assert
    expect(hasExpressionNoop).toBe(true);
    expect(hasConstantCondition).toBe(true);
  });

  it('should not report findings when expressions have side effects', () => {
    // Arrange
    let sources = new Map<string, string>();

    sources.set('/virtual/noop/safe.ts', createSafeSource());

    // Act
    let program = createProgramFromMap(sources);
    let analysis = analyzeNoop(program);

    // Assert
    expect(analysis.findings.length).toBe(0);
  });

  it('should return no findings when input is empty', () => {
    // Arrange
    let sources = new Map<string, string>();
    // Act
    let program = createProgramFromMap(sources);
    let analysis = analyzeNoop(program);

    // Assert
    expect(analysis.findings.length).toBe(0);
  });

  it('should report expression noops when objects and arrays are unused', () => {
    // Arrange
    let sources = new Map<string, string>();

    sources.set('/virtual/noop/object.ts', createObjectNoopSource());

    // Act
    let program = createProgramFromMap(sources);
    let analysis = analyzeNoop(program);
    let expressionNoops = analysis.findings.filter(finding => finding.kind === 'expression-noop');

    // Assert
    expect(expressionNoops.length).toBeGreaterThanOrEqual(1);
  });
});