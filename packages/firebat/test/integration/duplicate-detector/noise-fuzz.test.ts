import { describe, expect, it } from 'bun:test';

import { detectDuplicates } from '../../../src/features/duplicate-detector';
import { createPrng, createProgramFromMap, getFuzzIterations, getFuzzSeed, toDuplicateSignatures } from '../shared/test-kit';

const createDuplicateFunction = (functionName: string, literal: number): string => {
  return [`export function ${functionName}() {`, `  const value = ${literal};`, `  return value + 1;`, `}`].join('\n');
};

const createNoiseFunction = (functionName: string, literal: number): string => {
  return [`export function ${functionName}() {`, `  const noise = ${literal};`, `  return noise;`, `}`].join('\n');
};

const hasDuplicateGroup = (signatures: readonly string[]): boolean => {
  return signatures.some(signature => {
    const parts = signature.split('::');
    const itemsPart = parts[1] ?? '';
    const items = itemsPart.split(';').filter(item => item.length > 0);

    return items.length >= 2;
  });
};

describe('duplicate-detector (integration fuzz)', () => {
  it('should remain stable when extra non-duplicate code is present (seeded)', () => {
    // Arrange
    const seed = getFuzzSeed();
    const prng = createPrng(seed);
    const iterations = getFuzzIterations(160);

    // Act
    for (let iteration = 0; iteration < iterations; iteration += 1) {
      const sources = new Map<string, string>();
      const literal = prng.nextInt(10) + 1;
      const dupA = createDuplicateFunction(`dupA_${iteration}`, literal);
      const dupB = createDuplicateFunction(`dupB_${iteration}`, literal);
      const noiseCount = 1 + prng.nextInt(3);
      const noiseParts: string[] = [];

      for (let noiseIndex = 0; noiseIndex < noiseCount; noiseIndex += 1) {
        noiseParts.push(createNoiseFunction(`noise_${iteration}_${noiseIndex}`, prng.nextInt(20) + 1));
      }

      const filePath = `/virtual/fuzz/noise-${seed}-${iteration}.ts`;

      sources.set(filePath, [dupA, dupB, ...noiseParts].join('\n\n'));

      const program = createProgramFromMap(sources);
      const first = toDuplicateSignatures(detectDuplicates(program, 1));
      const second = toDuplicateSignatures(detectDuplicates(program, 1));

      // Assert
      expect(second).toEqual(first);
      expect(hasDuplicateGroup(first)).toBe(true);
    }
  });
});
