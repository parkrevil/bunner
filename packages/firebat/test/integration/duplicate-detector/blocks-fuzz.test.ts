import { describe, expect, it } from 'bun:test';

import { detectDuplicates } from '../../../src/features/duplicate-detector';
import { createPrng, createProgramFromMap, getFuzzIterations, getFuzzSeed } from '../shared/test-kit';

const createBlockPairSource = (firstName: string, secondName: string, literal: number): string => {
  return [
    `export function ${firstName}() {`,
    `  if (true) {`,
    `    const value = ${literal};`,
    `    console.log(value);`,
    `  }`,
    `}`,
    `export function ${secondName}() {`,
    `  if (true) {`,
    `    const value = ${literal};`,
    `    console.log(value);`,
    `  }`,
    `}`,
  ].join('\n');
};

const hasBlockDuplicateGroup = (groups: ReturnType<typeof detectDuplicates>): boolean => {
  return groups.some(group => group.items.filter(item => item.kind === 'node').length >= 2);
};

describe('duplicate-detector (integration fuzz)', () => {
  it('should find block-level duplicates when literals are randomized (seeded)', () => {
    // Arrange
    const seed = getFuzzSeed();
    const prng = createPrng(seed);
    const iterations = getFuzzIterations(120);

    // Act
    for (let iteration = 0; iteration < iterations; iteration += 1) {
      const literal = prng.nextInt(10) + 1;
      const filePath = `/virtual/fuzz/blocks-${seed}-${iteration}.ts`;
      const sources = new Map<string, string>();

      sources.set(filePath, createBlockPairSource(`first_${iteration}`, `second_${iteration}`, literal));

      const program = createProgramFromMap(sources);
      const groups = detectDuplicates(program, 1);
      const hasBlockDuplicate = hasBlockDuplicateGroup(groups);

      // Assert
      expect(hasBlockDuplicate).toBe(true);

      const groupsAgain = detectDuplicates(program, 1);

      expect(groupsAgain).toEqual(groups);
    }
  });
});
