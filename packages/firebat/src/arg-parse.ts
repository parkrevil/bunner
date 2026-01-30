import * as path from 'node:path';

import type { FirebatCliOptions } from './interfaces';
import type { FirebatDetector, MinSizeOption, OutputFormat } from './types';

const DEFAULT_MIN_SIZE: MinSizeOption = 'auto';
const DEFAULT_MAX_FORWARD_DEPTH = 0;
const DEFAULT_DETECTORS: ReadonlyArray<FirebatDetector> = [
  'duplicates',
  'waste',
  'typecheck',
  'dependencies',
  'coupling',
  'duplication',
  'nesting',
  'early-return',
  'noop',
  'api-drift',
  'forwarding',
];

const parseNumber = (value: string, label: string): number => {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error(`[firebat] Invalid ${label}: ${value}`);
  }

  return parsed;
};

const parseMinSize = (value: string): MinSizeOption => {
  if (value === 'auto') {
    return 'auto';
  }

  return parseNumber(value, '--min-size');
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
    if (
      selection !== 'duplicates' &&
      selection !== 'waste' &&
      selection !== 'typecheck' &&
      selection !== 'dependencies' &&
      selection !== 'coupling' &&
      selection !== 'duplication' &&
      selection !== 'nesting' &&
      selection !== 'early-return' &&
      selection !== 'noop' &&
      selection !== 'api-drift' &&
      selection !== 'forwarding'
    ) {
      throw new Error(
        `[firebat] Invalid --only: ${selection}. Expected duplicates|waste|typecheck|dependencies|coupling|duplication|nesting|early-return|noop|api-drift|forwarding`,
      );
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
  let minSize: MinSizeOption = DEFAULT_MIN_SIZE;
  let maxForwardDepth = DEFAULT_MAX_FORWARD_DEPTH;
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
        minSize,
        maxForwardDepth,
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

    if (arg === '--min-size') {
      const value = argv[i + 1];

      if (typeof value !== 'string') {
        throw new Error('[firebat] Missing value for --min-size');
      }

      minSize = parseMinSize(value);

      i += 1;

      continue;
    }

    if (arg === '--max-forward-depth') {
      const value = argv[i + 1];

      if (typeof value !== 'string') {
        throw new Error('[firebat] Missing value for --max-forward-depth');
      }

      maxForwardDepth = Math.max(0, Math.round(parseNumber(value, '--max-forward-depth')));

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
    minSize,
    maxForwardDepth,
    exitOnFindings,
    detectors,
    help: false,
  };
};

export { parseArgs };
