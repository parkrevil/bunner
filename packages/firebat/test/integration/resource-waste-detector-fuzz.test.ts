import { describe, expect, it } from 'bun:test';

import { detectResourceWaste } from '../../src/resource-waste-detector';
import { createPrng, createProgramFromMap, getFuzzIterations, getFuzzSeed, toWasteSignatures } from './test-kit';

const createNoRead = (functionName: string, literal: number): string => {
  return [`export function ${functionName}() {`, `  let value = ${literal};`, `  return 0;`, `}`].join('\n');
};

const createReadAtEnd = (functionName: string, literal: number): string => {
  return [`export function ${functionName}() {`, `  let value = ${literal};`, `  return value;`, `}`].join('\n');
};

const createReadViaIife = (functionName: string, literal: number): string => {
  return [`export function ${functionName}() {`, `  let value = ${literal};`, `  (() => value)();`, `  return 0;`, `}`].join(
    '\n',
  );
};

const createReadOnlyInUnreachableBranch = (functionName: string, literal: number): string => {
  return [
    `export function ${functionName}() {`,
    `  let value = ${literal};`,
    `  if (false) {`,
    `    value;`,
    `  }`,
    `  return 0;`,
    `}`,
  ].join('\n');
};

const createReadOnlyInReachableBranch = (functionName: string, literal: number): string => {
  return [
    `export function ${functionName}() {`,
    `  let value = ${literal};`,
    `  if (1) {`,
    `    value;`,
    `  }`,
    `  return 0;`,
    `}`,
  ].join('\n');
};

const createFuzzSource = (kind: number, name: string, literal: number): string => {
  const generators = [
    createNoRead,
    createReadAtEnd,
    createReadViaIife,
    createReadOnlyInUnreachableBranch,
    createReadOnlyInReachableBranch,
  ];
  const generator = generators[kind] ?? createNoRead;

  return generator(name, literal);
};

const createFuzzName = (kind: number, iteration: number): string => {
  const namePrefixes = ['noRead', 'read', 'iife', 'unreachable', 'reachable'];
  const namePrefix = namePrefixes[kind] ?? 'noRead';

  return `${namePrefix}_${iteration}`;
};

const hasValueDeadStore = (signatures: readonly string[]): boolean => {
  return signatures.some(signature => signature.includes('|dead-store|') && signature.endsWith('|value'));
};

const shouldHaveDeadStore = (kind: number): boolean => {
  return kind === 0 || kind === 3;
};

describe('integration/waste (fuzz)', () => {
  it('should flag dead-stores when values are not read (seeded)', () => {
    // Arrange
    const seed = getFuzzSeed();
    const prng = createPrng(seed);
    const iterations = getFuzzIterations(250);

    // Act
    for (let iteration = 0; iteration < iterations; iteration += 1) {
      const sources = new Map<string, string>();
      const literal = prng.nextInt(10) + 1;
      const kind = prng.nextInt(5);
      const filePath = `/virtual/fuzz/waste-${seed}-${iteration}.ts`;
      const name = createFuzzName(kind, iteration);

      sources.set(filePath, createFuzzSource(kind, name, literal));

      const program = createProgramFromMap(sources);
      const findings = toWasteSignatures(detectResourceWaste(program));
      const foundDeadStore = hasValueDeadStore(findings);
      const expectedDeadStore = shouldHaveDeadStore(kind);

      // Assert
      expect(foundDeadStore).toBe(expectedDeadStore);

      // Determinism: running again yields identical normalized findings.
      const findingsAgain = toWasteSignatures(detectResourceWaste(program));

      expect(findingsAgain).toEqual(findings);
    }
  });
});
