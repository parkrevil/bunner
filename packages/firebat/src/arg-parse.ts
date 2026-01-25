import * as path from 'node:path';

import type { FirebatCliOptions } from './interfaces';
import type { FirebatDetector, OutputFormat } from './types';

const DEFAULT_MIN_TOKENS = 60;
const DEFAULT_DETECTORS: ReadonlyArray<FirebatDetector> = ['duplicates', 'waste'];

const parseNumber = (value: string, label: string): number => {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error(`[firebat] Invalid ${label}: ${value}`);
  }

  return parsed;
};

const parseOutputFormat = (value: string): OutputFormat => {
  if (value === 'text' || value === 'json') {
    return value;
  }

  throw new Error(`[firebat] Invalid --format: ${value}. Expected text|json`);
};

const parseDetectors = (value: string): ReadonlyArray<FirebatDetector> => {
  const selections = value
    .split(',')
    .map(entry => entry.trim())
    .filter(entry => entry.length > 0);

  if (selections.length === 0) {
    throw new Error('[firebat] Missing value for --only');
  }

  const detectors: FirebatDetector[] = [];
  const seen = new Set<FirebatDetector>();

  for (const selection of selections) {
    if (selection !== 'duplicates' && selection !== 'waste') {
      throw new Error(`[firebat] Invalid --only: ${selection}. Expected duplicates|waste`);
    }

    if (seen.has(selection)) {
      continue;
    }

    seen.add(selection);
    detectors.push(selection);
  }

  if (detectors.length === 0) {
    throw new Error('[firebat] Missing value for --only');
  }

  return detectors;
};

const normalizeTarget = (raw: string): string => {
  const trimmed = raw.trim();

  if (trimmed.length === 0) {
    throw new Error('[firebat] Empty target path');
  }

  return path.resolve(trimmed);
};

const parseArgs = (argv: readonly string[]): FirebatCliOptions => {
  const targets: string[] = [];
  let format: OutputFormat = 'text';
  let minTokens = DEFAULT_MIN_TOKENS;
  let tsconfigPath: string | null = null;
  let exitOnFindings = true;
  let detectors: ReadonlyArray<FirebatDetector> = DEFAULT_DETECTORS;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (typeof arg !== 'string') {
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      return {
        targets: [],
        format,
        minTokens,
        tsconfigPath,
        exitOnFindings,
        detectors,
        help: true,
      };
    }

    if (arg === '--format') {
      const value = argv[i + 1];

      if (typeof value !== 'string') {
        throw new Error('[firebat] Missing value for --format');
      }

      format = parseOutputFormat(value);

      i += 1;

      continue;
    }

    if (arg === '--min-tokens') {
      const value = argv[i + 1];

      if (typeof value !== 'string') {
        throw new Error('[firebat] Missing value for --min-tokens');
      }

      minTokens = parseNumber(value, '--min-tokens');

      i += 1;

      continue;
    }

    if (arg === '--tsconfig') {
      const value = argv[i + 1];

      if (typeof value !== 'string') {
        throw new Error('[firebat] Missing value for --tsconfig');
      }

      tsconfigPath = normalizeTarget(value);

      i += 1;

      continue;
    }

    if (arg === '--no-exit') {
      exitOnFindings = false;

      continue;
    }

    if (arg === '--only') {
      const value = argv[i + 1];

      if (typeof value !== 'string') {
        throw new Error('[firebat] Missing value for --only');
      }

      detectors = parseDetectors(value);

      i += 1;

      continue;
    }

    if (arg.startsWith('-')) {
      throw new Error(`[firebat] Unknown option: ${arg}`);
    }

    targets.push(normalizeTarget(arg));
  }

  return {
    targets,
    format,
    minTokens,
    tsconfigPath,
    exitOnFindings,
    detectors,
    help: false,
  };
};

export { parseArgs };
