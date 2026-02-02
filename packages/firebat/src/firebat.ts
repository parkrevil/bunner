import type { FirebatCliOptions } from './interfaces';
import type { FirebatReport } from './types';

import { analyzeApiDrift, createEmptyApiDrift } from './features/api-drift';
import { analyzeCoupling, createEmptyCoupling } from './features/coupling';
import { analyzeDependencies, createEmptyDependencies } from './features/dependency-graph';
import { analyzeDuplication, createEmptyDuplication } from './features/duplication-analysis';
import { analyzeEarlyReturn, createEmptyEarlyReturn } from './features/early-return';
import { analyzeNesting, createEmptyNesting } from './features/nesting';
import { analyzeNoop, createEmptyNoop } from './features/noop';
import { analyzeForwarding, createEmptyForwarding } from './features/forwarding';
import { analyzeTypecheck, createEmptyTypecheck } from './features/typecheck';
import { parseArgs } from './arg-parse';
import { detectDuplicates } from './features/duplicate-detector';
import { initHasher } from './engine/hasher';
import { computeAutoMinSize } from './engine/auto-min-size';
import { formatReport } from './report';
import { detectWaste } from './features/waste';
import { createFirebatProgram } from './ts-program';
import { discoverDefaultTargets } from './target-discovery';

const printHelp = (): void => {
  const lines = [
    'firebat - Bunner code quality scanner',
    '',
    'Usage:',
    '  bun tooling/firebat/index.ts [targets...] [options]',
    '',
    'Defaults:',
    '  - If no targets are provided, firebat scans the repo sources automatically.',
    '  - If --only is not provided, all detectors are executed.',
    '',
    'Options:',
    '  --format text|json       Output format (default: text)',
    '  --min-size <n>           Minimum size threshold for duplicates (default: auto)',
    '  --max-forward-depth <n>  Max allowed thin-wrapper chain depth (default: 0)',
    '  --only <list>            Limit detectors to duplicates,waste,typecheck,dependencies,coupling,duplication,nesting,early-return,noop,api-drift,forwarding',
    '  --no-exit                Always exit 0 even if findings exist',
    '  -h, --help               Show this help',
  ];

  console.log(lines.join('\n'));
};

const buildReport = async (options: FirebatCliOptions): Promise<FirebatReport> => {
  const program = await createFirebatProgram({
    targets: options.targets,
  });
  const resolvedMinSize =
    options.minSize === 'auto' ? computeAutoMinSize(program) : Math.max(0, Math.round(options.minSize));
  const duplicates = options.detectors.includes('duplicates') ? detectDuplicates(program, resolvedMinSize) : [];
  const waste = options.detectors.includes('waste') ? detectWaste(program) : [];
  const typecheck = options.detectors.includes('typecheck') ? await analyzeTypecheck(program) : createEmptyTypecheck();
  const shouldRunDependencies = options.detectors.includes('dependencies') || options.detectors.includes('coupling');
  const dependencies = shouldRunDependencies ? analyzeDependencies(program) : createEmptyDependencies();
  const coupling = options.detectors.includes('coupling') ? analyzeCoupling(dependencies) : createEmptyCoupling();
  const duplication = options.detectors.includes('duplication')
    ? analyzeDuplication(program, resolvedMinSize)
    : createEmptyDuplication();
  const nesting = options.detectors.includes('nesting') ? analyzeNesting(program) : createEmptyNesting();
  const earlyReturn = options.detectors.includes('early-return') ? analyzeEarlyReturn(program) : createEmptyEarlyReturn();
  const noop = options.detectors.includes('noop') ? analyzeNoop(program) : createEmptyNoop();
  const apiDrift = options.detectors.includes('api-drift') ? analyzeApiDrift(program) : createEmptyApiDrift();
  const forwarding = options.detectors.includes('forwarding')
    ? analyzeForwarding(program, options.maxForwardDepth)
    : createEmptyForwarding();

  return {
    meta: {
      engine: 'oxc',
      version: '2.0.0-strict',
      targetCount: program.length,
      minSize: resolvedMinSize,
      maxForwardDepth: options.maxForwardDepth,
      detectors: options.detectors,
    },
    analyses: {
      duplicates,
      waste,
      typecheck,
      dependencies,
      coupling,
      duplication,
      nesting,
      earlyReturn,
      noop,
      apiDrift,
      forwarding,
    },
  };
};

const countBlockingFindings = (report: FirebatReport): number => {
  const typecheckErrors = report.analyses.typecheck.items.filter(item => item.severity === 'error').length;
  const forwardingFindings = report.analyses.forwarding.findings.length;

  return report.analyses.duplicates.length + report.analyses.waste.length + typecheckErrors + forwardingFindings;
};

const runFirebat = async (): Promise<void> => {
  let options: FirebatCliOptions;

  try {
    const argv: readonly string[] = Bun.argv.slice(2);

    options = parseArgs(argv);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    console.error(message);

    process.exit(1);
  }

  if (options.help) {
    printHelp();

    return;
  }

  if (options.targets.length === 0) {
    try {
      const targets = await discoverDefaultTargets(process.cwd());

      options = {
        ...options,
        targets,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      console.error(`[firebat] Failed to discover default targets: ${message}`);

      process.exit(1);
    }
  }

  await initHasher();

  let report: FirebatReport;

  try {
    report = await buildReport(options);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    console.error(`[firebat] Failed: ${message}`);

    process.exit(1);
  }

  const output = formatReport(report, options.format);

  console.log(output);

  const findingCount = countBlockingFindings(report);

  if (findingCount > 0 && options.exitOnFindings) {
    process.exit(1);
  }
};

export { runFirebat };
