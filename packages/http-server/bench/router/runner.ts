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
};

type BenchmarkFile = {
  benchmarks?: BenchmarkEntry[];
  results?: BenchmarkEntry[];
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

await runJsonBench(jsonOutputPath, baseEnv);
await runCpuProfile(profileName, baseEnv);

console.log('[router bench] artifacts');
console.log(`  • metrics: ${makePrettyPath(jsonOutputPath)}`);
console.log(`  • profile: ${makePrettyPath(join(resultsDirAbs, profileName))}`);
console.log('open the .cpuprofile file in Chrome DevTools or VS Code > Profile to inspect flame graphs.');

reportDiffSummary(jsonOutputPath, profileName);

async function runJsonBench(outputPath: string, env: Record<string, string | undefined>): Promise<void> {
  const proc = Bun.spawn({
    cmd: ['bun', benchEntry],
    stdout: 'pipe',
    stderr: 'inherit',
    env: {
      ...env,
      ROUTER_BENCH_FORMAT: 'json',
      ROUTER_BENCH_PROFILE: '0',
    },
  });
  const stdout = await new Response(proc.stdout).text();
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`router bench (json) failed with exit code ${exitCode}`);
  }
  writeFileSync(outputPath, stdout);
}

async function runCpuProfile(profileFile: string, env: Record<string, string | undefined>): Promise<void> {
  const proc = Bun.spawn({
    cmd: ['bun', '--cpu-prof', '--cpu-prof-name', profileFile, '--cpu-prof-dir', resultsDirForSpawn, benchEntry],
    stdout: 'inherit',
    stderr: 'inherit',
    env,
  });
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`router bench (cpu-prof) failed with exit code ${exitCode}`);
  }
}

function makePrettyPath(target: string): string {
  const rel = relative(process.cwd(), target);
  return rel && !rel.startsWith('..') ? rel : target;
}

function reportDiffSummary(currentJsonPath: string, currentProfileName: string): void {
  const currentProfilePath = join(resultsDirAbs, currentProfileName);
  compareJsonResults(currentJsonPath);
  compareCpuProfiles(currentProfilePath);
}

function compareJsonResults(currentJsonPath: string): void {
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
    comparisons.push({ label, prevStats, currStats, avgDelta });
  }

  console.log(`[router bench diff] json: ${basename(previousJsonPath)} 대비 결과`);
  if (comparisons.length === 0) {
    console.log('  공통 벤치마크가 없어 비교할 수 없습니다.');
  } else {
    const sorted = comparisons.sort((a, b) => Math.abs(b.avgDelta ?? 0) - Math.abs(a.avgDelta ?? 0));
    const tableRows = sorted.map(({ label, prevStats, currStats }) => buildTableRow(label, prevStats, currStats));
    console.table(tableRows);
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
  const parsed = JSON.parse(raw) as BenchmarkFile | BenchmarkEntry[];
  if (Array.isArray(parsed)) {
    return parsed;
  }
  if (Array.isArray(parsed.benchmarks)) {
    return parsed.benchmarks;
  }
  if (Array.isArray(parsed.results)) {
    return parsed.results;
  }
  return [];
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
