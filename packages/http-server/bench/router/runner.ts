import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const METRICS = ['avg', 'p50', 'p75', 'p99', 'p999', 'min', 'max'] as const;
const COLORS = {
  reset: '\u001B[0m',
  gold: '\u001B[38;5;178m',
  red: '\u001B[31m',
  brightGreenBold: '\u001B[1;92m',
} as const;
type ColorVariant = 'base' | 'increase' | 'decrease';
type MetricName = (typeof METRICS)[number];

type BenchmarkEntry = {
  name: string;
  group?: string;
  stats?: Partial<Record<MetricName, number>> & Record<string, unknown>;
  variability?: VariabilityStats;
};

type BenchmarkFile = {
  benchmarks?: BenchmarkEntry[];
  results?: BenchmarkEntry[];
  meta?: Record<string, unknown>;
};

type VariabilityStats = {
  samples: number;
  stddev?: Partial<Record<MetricName, number>>;
};

type RunnerConfig = {
  runCount: number;
  cpuset?: string;
  zScoreThreshold: number;
};

const here = fileURLToPath(new URL('.', import.meta.url));
const benchEntry = join(here, 'router.bench.ts');
const resultsDirAbs = join(here, 'results');
mkdirSync(resultsDirAbs, { recursive: true });
const resultsDirForSpawn = relative(process.cwd(), resultsDirAbs) || '.';

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const jsonOutputPath = join(resultsDirAbs, `router-bench-${timestamp}.json`);
const profileName = `router-bench-${timestamp}.cpuprofile`;

const baseEnv = { ...process.env };
const runnerConfig = resolveRunnerConfig(baseEnv);
const governorController = createGovernorController(process.env.ROUTER_BENCH_CPU_GOVERNOR);

try {
  governorController?.apply();
  await runJsonBenchSeries(jsonOutputPath, baseEnv, runnerConfig, timestamp);
  await runCpuProfile(profileName, baseEnv, runnerConfig);
} finally {
  governorController?.restore();
}

console.log('[router bench] artifacts');
console.log(`  • metrics: ${makePrettyPath(jsonOutputPath)}`);
console.log(`  • profile: ${makePrettyPath(join(resultsDirAbs, profileName))}`);
console.log('open the .cpuprofile file in Chrome DevTools or VS Code > Profile to inspect flame graphs.');

reportDiffSummary(jsonOutputPath, profileName, runnerConfig);

async function runJsonBenchSeries(
  outputPath: string,
  env: Record<string, string | undefined>,
  config: RunnerConfig,
  stamp: string,
): Promise<void> {
  const runEntries: BenchmarkEntry[][] = [];
  const rawArtifacts: string[] = [];
  for (let i = 0; i < config.runCount; i++) {
    const payload = await runSingleJsonBench(env, config, i);
    const rawName = `router-bench-${stamp}-run${String(i + 1).padStart(2, '0')}.raw.json`;
    const rawPath = join(resultsDirAbs, rawName);
    writeFileSync(rawPath, payload);
    rawArtifacts.push(rawName);
    runEntries.push(parseBenchmarksFromPayload(payload));
  }
  const aggregated = aggregateBenchmarks(runEntries);
  const doc = {
    benchmarks: aggregated,
    meta: {
      runCount: config.runCount,
      rawRuns: rawArtifacts,
      generatedAt: new Date().toISOString(),
    },
  } satisfies BenchmarkFile;
  writeFileSync(outputPath, `${JSON.stringify(doc, null, 2)}\n`);
}

async function runSingleJsonBench(
  env: Record<string, string | undefined>,
  config: RunnerConfig,
  runIndex: number,
): Promise<string> {
  const cmd = buildSpawnCommand(['bun', benchEntry], config);
  const proc = Bun.spawn({
    cmd,
    stdout: 'pipe',
    stderr: 'inherit',
    env: {
      ...env,
      ROUTER_BENCH_FORMAT: 'json',
      ROUTER_BENCH_PROFILE: '0',
      ROUTER_BENCH_RUN_INDEX: String(runIndex + 1),
      ROUTER_BENCH_RUN_TOTAL: String(config.runCount),
    },
  });
  const stdout = await new Response(proc.stdout).text();
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`router bench (json) run #${runIndex + 1} failed with exit code ${exitCode}`);
  }
  const payload = extractJsonPayload(stdout);
  if (!payload) {
    throw new Error('router bench (json) did not emit valid JSON payload');
  }
  return payload;
}

async function runCpuProfile(profileFile: string, env: Record<string, string | undefined>, config: RunnerConfig): Promise<void> {
  const cmd = buildSpawnCommand(
    ['bun', '--cpu-prof', '--cpu-prof-name', profileFile, '--cpu-prof-dir', resultsDirForSpawn, benchEntry],
    config,
  );
  const proc = Bun.spawn({
    cmd,
    stdout: 'inherit',
    stderr: 'inherit',
    env,
  });
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`router bench (cpu-prof) failed with exit code ${exitCode}`);
  }
}

function resolveRunnerConfig(env: Record<string, string | undefined>): RunnerConfig {
  const runCount = clampInt(env.ROUTER_BENCH_RUNS ?? process.env.ROUTER_BENCH_RUNS ?? '1', 1, 10);
  const cpusetRaw = process.env.ROUTER_BENCH_CPUSET?.trim() || env.ROUTER_BENCH_CPUSET?.trim();
  const cpuset = cpusetRaw && validateCpuSet(cpusetRaw) ? cpusetRaw : undefined;
  if (cpusetRaw && !cpuset) {
    console.warn(`[router bench] 무효한 CPU core 목록 '${cpusetRaw}' — 예: 0-5,8`);
  }
  const thresholdRaw = process.env.ROUTER_BENCH_Z ?? env.ROUTER_BENCH_Z ?? '2.5';
  const zScoreThreshold = Number(thresholdRaw);
  return {
    runCount,
    cpuset: process.platform === 'linux' ? cpuset : undefined,
    zScoreThreshold: Number.isFinite(zScoreThreshold) ? zScoreThreshold : 2.5,
  };
}

function clampInt(value: string, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return min;
  }
  const rounded = Math.trunc(parsed);
  if (rounded < min) {
    return min;
  }
  if (rounded > max) {
    return max;
  }
  return rounded;
}

function validateCpuSet(value: string): boolean {
  return /^[0-9,-]+$/.test(value);
}

function buildSpawnCommand(baseCmd: string[], config: RunnerConfig): string[] {
  if (!config.cpuset || process.platform !== 'linux') {
    return baseCmd;
  }
  return ['taskset', '-c', config.cpuset, ...baseCmd];
}

class CpuGovernorController {
  private readonly original: Array<{ path: string; value: string }>;
  private applied = false;
  private warned = false;

  constructor(private readonly target: string) {
    this.original = [];
  }

  apply(): void {
    if (this.applied || !this.target || process.platform !== 'linux') {
      return;
    }
    const cpuRoot = '/sys/devices/system/cpu';
    let touched = 0;
    for (const entry of readdirSync(cpuRoot)) {
      if (!/^cpu\d+$/.test(entry)) {
        continue;
      }
      const governorPath = join(cpuRoot, entry, 'cpufreq', 'scaling_governor');
      try {
        const current = readFileSync(governorPath, 'utf8').trim();
        this.original.push({ path: governorPath, value: current });
        if (current !== this.target) {
          writeFileSync(governorPath, `${this.target}\n`);
          touched++;
        }
      } catch (error) {
        this.handleGovernorError(error);
      }
    }
    if (touched) {
      console.log(`[router bench] CPU governor '${this.target}' applied to ${touched} cores`);
    }
    this.applied = true;
  }

  restore(): void {
    if (!this.applied) {
      return;
    }
    for (const entry of this.original) {
      try {
        writeFileSync(entry.path, `${entry.value}\n`);
      } catch (error) {
        this.handleGovernorError(error);
      }
    }
    this.applied = false;
  }

  private handleGovernorError(err: unknown): void {
    if (this.warned) {
      return;
    }
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[router bench] CPU governor 조정 실패: ${message.trim()}. 관리자 권한이 필요할 수 있습니다.`);
    this.warned = true;
  }
}

function createGovernorController(target?: string): CpuGovernorController | undefined {
  if (!target) {
    return undefined;
  }
  if (process.platform !== 'linux') {
    console.warn('[router bench] CPU governor 고정은 Linux에서만 지원합니다.');
    return undefined;
  }
  return new CpuGovernorController(target.trim());
}

function makePrettyPath(target: string): string {
  const rel = relative(process.cwd(), target);
  return rel && !rel.startsWith('..') ? rel : target;
}

function reportDiffSummary(currentJsonPath: string, currentProfileName: string, config: RunnerConfig): void {
  const currentProfilePath = join(resultsDirAbs, currentProfileName);
  compareJsonResults(currentJsonPath, config);
  compareCpuProfiles(currentProfilePath);
}

function compareJsonResults(currentJsonPath: string, config: RunnerConfig): void {
  const previousJsonPath = findPreviousArtifact(currentJsonPath, '.json');
  if (!previousJsonPath) {
    console.log('[router bench diff] json: 최초 실행이라 비교 대상이 없습니다.');
    return;
  }

  const currentEntries = loadBenchmarks(currentJsonPath);
  const previousEntries = loadBenchmarks(previousJsonPath);
  const previousMap = new Map<string, BenchmarkEntry>();
  for (const entry of previousEntries) {
    previousMap.set(makeBenchKey(entry), entry);
  }

  const removedKeys = new Set(previousMap.keys());
  const newBenches: string[] = [];
  type ComparisonEntry = {
    label: string;
    prevStats: NumericStats;
    currStats: NumericStats;
    avgDelta: number;
    zScore?: number;
  };
  const comparisons: ComparisonEntry[] = [];

  for (const entry of currentEntries) {
    const key = makeBenchKey(entry);
    const prev = previousMap.get(key);
    if (!prev) {
      newBenches.push(key);
      continue;
    }
    removedKeys.delete(key);
    const currStats = extractStats(entry);
    const prevStats = extractStats(prev);
    if (!hasComparableMetric(currStats, prevStats)) {
      continue;
    }
    const label = `${entry.group ?? 'ungrouped'} › ${entry.name}`;
    const avgDelta = (currStats.avg ?? 0) - (prevStats.avg ?? 0);
    const zScore = computeZScore(prev, entry, avgDelta);
    comparisons.push({ label, prevStats, currStats, avgDelta, zScore });
  }

  console.log(`[router bench diff] json: ${basename(previousJsonPath)} 대비 결과`);
  if (comparisons.length === 0) {
    console.log('  공통 벤치마크가 없어 비교할 수 없습니다.');
  } else {
    const sorted = comparisons.sort((a, b) => Math.abs(b.avgDelta ?? 0) - Math.abs(a.avgDelta ?? 0));
    const tableRows = sorted.map(({ label, prevStats, currStats }) => buildTableRow(label, prevStats, currStats));
    console.table(tableRows);
    const flagged = sorted.filter(entry => entry.zScore !== undefined && Math.abs(entry.zScore) >= config.zScoreThreshold);
    if (flagged.length) {
      console.log(`  통계적 경보 (|z| ≥ ${config.zScoreThreshold}):`);
      for (const entry of flagged.slice(0, 12)) {
        const direction = entry.avgDelta >= 0 ? 'regression' : 'improvement';
        const zText = formatZScore(entry.zScore!);
        console.log(`    - ${entry.label}: Δavg=${formatDelta(entry.avgDelta)} (z=${zText}, ${direction})`);
      }
    }
  }

  if (newBenches.length) {
    console.log(`  신규 벤치마크 (${newBenches.length}): ${newBenches.join(', ')}`);
  }
  if (removedKeys.size) {
    console.log(`  제거된 벤치마크 (${removedKeys.size}): ${Array.from(removedKeys).join(', ')}`);
  }
}

function compareCpuProfiles(currentProfilePath: string): void {
  const previousProfilePath = findPreviousArtifact(currentProfilePath, '.cpuprofile');
  if (!previousProfilePath) {
    console.log('[router bench diff] cpu-prof: 최초 실행이라 비교 대상이 없습니다.');
    return;
  }
  const currentSize = statSync(currentProfilePath).size;
  const previousSize = statSync(previousProfilePath).size;
  const delta = currentSize - previousSize;
  const deltaPct = previousSize === 0 ? null : (delta / previousSize) * 100;
  const direction = delta === 0 ? '변화 없음' : delta > 0 ? '더 큼' : '더 작음';
  console.log(`[router bench diff] cpu-prof: ${basename(previousProfilePath)} 대비 결과`);
  const byteDelta = delta === 0 ? '' : `, Δ=${formatBytes(Math.abs(delta))}`;
  const pctDelta = deltaPct !== null && Number.isFinite(deltaPct) ? `, ${deltaPct >= 0 ? '+' : ''}${deltaPct.toFixed(2)}%` : '';
  console.log(`  파일 크기: ${formatBytes(previousSize)} → ${formatBytes(currentSize)} (${direction}${byteDelta}${pctDelta})`);
  console.log('  flame graph 비교는 두 .cpuprofile 파일을 DevTools에 함께 로드해 확인하세요.');
}

function loadBenchmarks(filePath: string): BenchmarkEntry[] {
  const raw = readFileSync(filePath, 'utf8');
  const payload = extractJsonPayload(raw);
  if (!payload) {
    throw new Error(`[router bench] ${makePrettyPath(filePath)} has no JSON payload to parse.`);
  }
  return parseBenchmarksFromPayload(payload);
}

function makeBenchKey(entry: BenchmarkEntry): string {
  return `${entry.group ?? 'ungrouped'}::${entry.name}`;
}

function findPreviousArtifact(currentPath: string, extension: string): string | undefined {
  const dir = resultsDirAbs;
  const files = readdirSync(dir)
    .filter(file => file.endsWith(extension))
    .sort();
  const currentName = basename(currentPath);
  let previous: string | undefined;
  for (const file of files) {
    if (file === currentName) {
      break;
    }
    previous = file;
  }
  return previous ? join(dir, previous) : undefined;
}

function formatDuration(value: number): string {
  if (value >= 1e9) {
    return `${(value / 1e9).toFixed(2)} s`;
  }
  if (value >= 1e6) {
    return `${(value / 1e6).toFixed(2)} ms`;
  }
  if (value >= 1e3) {
    return `${(value / 1e3).toFixed(2)} µs`;
  }
  return `${value.toFixed(2)} ns`;
}

function formatBytes(value: number): string {
  if (value >= 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(2)} MB`;
  }
  if (value >= 1024) {
    return `${(value / 1024).toFixed(2)} KB`;
  }
  return `${value} B`;
}

type NumericStats = Partial<Record<MetricName, number>>;

type MetricBucket = {
  sum: number;
  values: number[];
};

type AggregationBucket = {
  name: string;
  group?: string;
  metrics: Partial<Record<MetricName, MetricBucket>>;
  samples: number;
};

function parseBenchmarksFromPayload(payload: string): BenchmarkEntry[] {
  const parsed = JSON.parse(payload) as BenchmarkFile | BenchmarkEntry[];
  if (Array.isArray(parsed)) {
    return parsed.map(cloneBenchmarkEntry);
  }
  if (Array.isArray(parsed.benchmarks)) {
    return parsed.benchmarks.map(cloneBenchmarkEntry);
  }
  if (Array.isArray(parsed.results)) {
    return parsed.results.map(cloneBenchmarkEntry);
  }
  return [];
}

function cloneBenchmarkEntry(entry: BenchmarkEntry): BenchmarkEntry {
  return {
    name: entry.name,
    group: entry.group,
    stats: entry.stats ? { ...entry.stats } : undefined,
    variability: entry.variability
      ? {
          samples: entry.variability.samples,
          stddev: entry.variability.stddev ? { ...entry.variability.stddev } : undefined,
        }
      : undefined,
  };
}

function aggregateBenchmarks(runs: BenchmarkEntry[][]): BenchmarkEntry[] {
  if (!runs.length) {
    return [];
  }
  if (runs.length === 1) {
    return runs[0]!.map(entry => ({
      name: entry.name,
      group: entry.group,
      stats: entry.stats ? { ...entry.stats } : undefined,
      variability: entry.variability ?? { samples: 1 },
    }));
  }
  const buckets = new Map<string, AggregationBucket>();
  for (const entries of runs) {
    for (const entry of entries) {
      const key = makeBenchKey(entry);
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = { name: entry.name, group: entry.group, metrics: {}, samples: 0 };
        buckets.set(key, bucket);
      }
      bucket.samples++;
      for (const metric of METRICS) {
        const value = entry.stats?.[metric];
        if (typeof value !== 'number') {
          continue;
        }
        let metricBucket = bucket.metrics[metric];
        if (!metricBucket) {
          metricBucket = { sum: 0, values: [] };
          bucket.metrics[metric] = metricBucket;
        }
        metricBucket.sum += value;
        metricBucket.values.push(value);
      }
    }
  }
  const aggregated: BenchmarkEntry[] = [];
  for (const bucket of buckets.values()) {
    const stats: Partial<Record<MetricName, number>> = {};
    const stddev: Partial<Record<MetricName, number>> = {};
    for (const metric of METRICS) {
      const metricBucket = bucket.metrics[metric];
      if (!metricBucket || metricBucket.values.length === 0) {
        continue;
      }
      const count = metricBucket.values.length;
      const mean = metricBucket.sum / count;
      stats[metric] = mean;
      if (count > 1) {
        let variance = 0;
        for (const value of metricBucket.values) {
          const diff = value - mean;
          variance += diff * diff;
        }
        variance /= count - 1;
        stddev[metric] = Math.sqrt(variance);
      }
    }
    const variability: VariabilityStats = {
      samples: bucket.samples,
      stddev: Object.keys(stddev).length ? stddev : undefined,
    };
    aggregated.push({ name: bucket.name, group: bucket.group, stats, variability });
  }
  aggregated.sort((a, b) => makeBenchKey(a).localeCompare(makeBenchKey(b)));
  return aggregated;
}

function extractStats(entry: BenchmarkEntry): NumericStats {
  const stats = entry.stats ?? {};
  const result: NumericStats = {};
  for (const metric of METRICS) {
    const value = stats[metric];
    if (typeof value === 'number') {
      result[metric] = value;
    }
  }
  return result;
}

function hasComparableMetric(a: NumericStats, b: NumericStats): boolean {
  return METRICS.some(metric => typeof a[metric] === 'number' && typeof b[metric] === 'number');
}

function buildTableRow(label: string, prevStats: NumericStats, currStats: NumericStats): Record<string, string> {
  const row: Record<string, string> = { benchmark: label };
  for (const metric of METRICS) {
    row[metric] = formatMetricCell(prevStats[metric], currStats[metric]);
  }
  return row;
}

function formatMetricCell(prevValue?: number, currValue?: number): string {
  if (typeof prevValue !== 'number' || typeof currValue !== 'number') {
    return 'N/A';
  }
  const delta = currValue - prevValue;
  const pct = prevValue === 0 ? null : (delta / prevValue) * 100;
  const trend = delta === 0 ? '→' : delta > 0 ? '▲' : '▼';
  const variant: ColorVariant = delta === 0 ? 'base' : delta > 0 ? 'increase' : 'decrease';
  const prevText = colorize(formatDuration(prevValue), 'base');
  const currText = colorize(formatDuration(currValue), variant);
  const pctText =
    pct === null || !Number.isFinite(pct) ? '' : ` ${colorize(`${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`, variant)}`;
  return `${prevText} ${trend} ${currText}${pctText}`;
}

function colorize(value: string, variant: ColorVariant): string {
  const color = variant === 'increase' ? COLORS.red : variant === 'decrease' ? COLORS.brightGreenBold : COLORS.gold;
  return `${color}${value}${COLORS.reset}`;
}

function formatDelta(delta: number): string {
  if (delta === 0) {
    return '±0';
  }
  const sign = delta > 0 ? '+' : '-';
  return `${sign}${formatDuration(Math.abs(delta))}`;
}

function formatZScore(value: number): string {
  if (!Number.isFinite(value)) {
    return value > 0 ? '+∞' : '-∞';
  }
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}`;
}

function computeZScore(prevEntry: BenchmarkEntry, currEntry: BenchmarkEntry, delta: number): number | undefined {
  const prevStd = prevEntry.variability?.stddev?.avg ?? 0;
  const currStd = currEntry.variability?.stddev?.avg ?? 0;
  const hasPrev = (prevEntry.variability?.samples ?? 0) > 1;
  const hasCurr = (currEntry.variability?.samples ?? 0) > 1;
  if (!hasPrev && !hasCurr) {
    return undefined;
  }
  const variance = prevStd * prevStd + currStd * currStd;
  if (variance === 0) {
    if (!delta) {
      return 0;
    }
    return delta > 0 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
  }
  return delta / Math.sqrt(variance);
}

function extractJsonPayload(raw: string): string | null {
  const start = raw.indexOf('{');
  if (start === -1) {
    return null;
  }
  const end = raw.lastIndexOf('}');
  if (end === -1 || end < start) {
    return null;
  }
  return raw.slice(start, end + 1);
}