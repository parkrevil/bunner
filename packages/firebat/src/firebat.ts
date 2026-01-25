import * as path from 'node:path';

import type { FirebatCliOptions } from './interfaces';
import type { FirebatReport } from './types';

import { parseArgs } from './arg-parse';
import { detectDuplicates } from './duplicate-detector';
import { initHasher } from './engine/hasher';
import { formatReport } from './report';
import { detectResourceWaste } from './resource-waste-detector';
import { createFirebatProgram } from './ts-program';

const printHelp = (): void => {
  const lines = [
    'firebat - Bunner code quality scanner (duplicates + waste)',
    '',
    'Usage:',
    '  bun tooling/firebat/index.ts [targets...] [options]',
    '',
    'Options:',
    '  --format text|json       Output format (default: text)',
    '  --min-tokens <n>         Minimum token threshold for duplicates (default: 60)',
    '  --tsconfig <path>        Path to tsconfig.json (default: repo root tsconfig.json)',
    '  --only <list>            Limit detectors to duplicates,waste (comma-separated)',
    '  --no-exit                Always exit 0 even if findings exist',
    '  -h, --help               Show this help',
  ];

  console.log(lines.join('\n'));
};

const resolveDefaultTsconfig = (): string => path.resolve(process.cwd(), 'tsconfig.json');

const buildReport = (options: FirebatCliOptions): FirebatReport => {
  const tsconfigPath = options.tsconfigPath ?? resolveDefaultTsconfig();
  const program = createFirebatProgram({
    tsconfigPath,
    targets: options.targets,
  });
  const duplicates = options.detectors.includes('duplicates') ? detectDuplicates(program, options.minTokens) : [];
  const waste = options.detectors.includes('waste') ? detectResourceWaste(program) : [];

  return {
    meta: {
      engine: 'oxc',
      version: '2.0.0-strict',
      tsconfigPath,
      targetCount: program.length,
      minTokens: options.minTokens,
      detectors: options.detectors,
    },
    duplicates,
    waste,
  };
};

const runFirebat = async (): Promise<void> => {
  let options: FirebatCliOptions;

  try {
    options = parseArgs(process.argv.slice(2));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    console.error(message);

    process.exit(1);
  }

  if (options.help) {
    printHelp();

    return;
  }

  await initHasher();

  let report: FirebatReport;

  try {
    report = buildReport(options);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    console.error(`[firebat] Failed: ${message}`);

    process.exit(1);
  }

  const output = formatReport(report, options.format);

  console.log(output);

  const findingCount = report.duplicates.length + report.waste.length;

  if (findingCount > 0 && options.exitOnFindings) {
    process.exit(1);
  }
};

export { runFirebat };
