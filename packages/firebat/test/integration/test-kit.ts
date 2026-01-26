import type { ParsedFile } from '../../src/engine/oxc-wrapper';
import type { DuplicateGroup, ResourceWasteFinding } from '../../src/types';

import { parseSource } from '../../src/engine/oxc-wrapper';

const parseSeed = (seedText: string | undefined): number => {
  if (!seedText) {
    return 1;
  }

  const trimmed = seedText.trim();

  if (trimmed.length === 0) {
    return 1;
  }

  const asNumber = Number(trimmed);

  if (Number.isFinite(asNumber)) {
    return (asNumber | 0) >>> 0;
  }

  return 1;
};

export const getFuzzSeed = (): number => {
  return parseSeed(Bun.env.FIREBAT_FUZZ_SEED);
};

export const getFuzzIterations = (fallback: number): number => {
  const raw = Bun.env.FIREBAT_FUZZ_ITERS;

  if (!raw) {
    return fallback;
  }

  const parsed = Number(raw);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.floor(parsed);
};

export const createPrng = (seed: number) => {
  let state = (seed | 0) >>> 0;

  const nextU32 = (): number => {
    // xorshift32
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state >>>= 0;
    state ^= state << 5;
    state >>>= 0;

    return state;
  };

  const nextInt = (maxExclusive: number): number => {
    if (maxExclusive <= 0) {
      return 0;
    }

    return nextU32() % maxExclusive;
  };

  const nextBool = (): boolean => {
    return (nextU32() & 1) === 1;
  };

  const pick = <T>(items: readonly T[]): T => {
    return items[nextInt(items.length)];
  };

  return {
    nextU32,
    nextInt,
    nextBool,
    pick,
  };
};

export const createProgramFromMap = (sources: Map<string, string>): ParsedFile[] => {
  const files: ParsedFile[] = [];

  for (const [filePath, sourceText] of sources.entries()) {
    files.push(parseSource(filePath, sourceText));
  }

  return files;
};

export const toDuplicateSignatures = (groups: ReadonlyArray<DuplicateGroup>): string[] => {
  const signatures: string[] = [];

  for (const group of groups) {
    const itemKeys = [...group.items].map(item => {
      return `${item.filePath}|${item.kind}|${item.header}|${item.tokens}`;
    });

    itemKeys.sort((left, right) => left.localeCompare(right));

    signatures.push(`${group.fingerprint}::${itemKeys.join(';')}`);
  }

  signatures.sort((left, right) => left.localeCompare(right));

  return signatures;
};

export const toWasteSignatures = (findings: ReadonlyArray<ResourceWasteFinding>): string[] => {
  const keys = [...findings].map(finding => {
    return `${finding.filePath}|${finding.kind}|${finding.label}`;
  });

  keys.sort((left, right) => left.localeCompare(right));

  return keys;
};
