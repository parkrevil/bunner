import { describe, expect, it } from 'bun:test';

import { analyzeForwarding } from '../../../src/features/forwarding';
import { createProgramFromMap } from '../shared/test-kit';

const createForwardingSource = (): string => {
  return [
    'function target(value) {',
    '  return value + 1;',
    '}',
    'function wrapper(value) {',
    '  return target(value);',
    '}',
  ].join('\n');
};

const createForwardingChainSource = (): string => {
  return [
    'function c(value) {',
    '  return value;',
    '}',
    'function b(value) {',
    '  return c(value);',
    '}',
    'function a(value) {',
    '  return b(value);',
    '}',
  ].join('\n');
};

describe('integration/forwarding', () => {
  it('should report thin wrappers when they only forward arguments', () => {
    // Arrange
    const sources = new Map<string, string>();

    sources.set('/virtual/forwarding/forward.ts', createForwardingSource());

    // Act
    const program = createProgramFromMap(sources);
    const analysis = analyzeForwarding(program, 0);
    const thinWrappers = analysis.findings.filter(finding => finding.kind === 'thin-wrapper');

    // Assert
    expect(thinWrappers.length).toBe(1);
    expect(thinWrappers[0]?.header).toBe('wrapper');
  });

  it('should report chain depth when it exceeds max', () => {
    // Arrange
    const sources = new Map<string, string>();

    sources.set('/virtual/forwarding/chain.ts', createForwardingChainSource());

    // Act
    const program = createProgramFromMap(sources);
    const analysis = analyzeForwarding(program, 1);
    const chainFindings = analysis.findings.filter(finding => finding.kind === 'forward-chain');

    // Assert
    expect(chainFindings.length).toBe(1);
    expect(chainFindings[0]?.header).toBe('a');
  });
});
