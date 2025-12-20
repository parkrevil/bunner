import { readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const METRICS = ['avg', 'p50', 'p75', 'p99', 'p999', 'min', 'max'] as const;
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
};

type NumericStats = Partial<Record<MetricName, number>>;

type VariabilityStats = {
  samples: number;
  stddev?: Partial<Record<MetricName, number>>;
};

type CompareKind = 'json' | 'cpu';

type ArtifactPair = { latest: string; previous: string } | undefined;

const here = fileURLToPath(new URL('.', import.meta.url));
const resultsDir = join(here, 'results');

run();

function run(): void {
  const targets: CompareKind[] = parseTargets(process.argv.slice(2));
  if (!targets.length) {
    targets.push('json', 'cpu');
  }
  for (const target of targets) {
    if (target === 'json') {
      compareJsonArtifacts();
    } else {
      compareCpuProfiles();
    }
  }
}

function parseTargets(flags: string[]): CompareKind[] {
  const set = new Set<CompareKind>();
  for (const flag of flags) {
    if (flag === '--json') {
      set.add('json');
    } else if (flag === '--cpu') {
      set.add('cpu');
    } else if (flag === '--help' || flag === '-h') {
      printUsage();
      process.exit(0);
    }
  }
  return Array.from(set);
}

function printUsage(): void {
  console.log('Usage: bun packages/http-server/bench/router/compare.ts [--json] [--cpu]');
  console.log('Compares the two most recent benchmark JSON and/or CPU profile artifacts beneath ./results');
}

function compareJsonArtifacts(): void {
  const pair = findArtifactPair('.json');
  if (!pair) {
    console.log('[router bench compare] json: 비교 가능한 이전 결과가 없습니다.');
    return;
  }
  const previousEntries = loadBenchmarks(pair.previous);
  const latestEntries = loadBenchmarks(pair.latest);
  const previousMap = new Map<string, BenchmarkEntry>();
  for (const entry of previousEntries) {
    previousMap.set(makeBenchKey(entry), entry);
  }

  const removed = new Set(previousMap.keys());
  const newBenches: string[] = [];
  const comparisons: Array<{ label: string; prev: NumericStats; curr: NumericStats; delta: number; zScore?: number }> = [];
  for (const entry of latestEntries) {
    const key = makeBenchKey(entry);
    const prev = previousMap.get(key);
    if (!prev) {
      newBenches.push(key);
      continue;
    }
    removed.delete(key);
    const currStats = extractStats(entry);
    const prevStats = extractStats(prev);
    if (!hasComparableMetric(currStats, prevStats)) {
      continue;
    }
    const label = `${entry.group ?? 'ungrouped'} › ${entry.name}`;
    const delta = (currStats.avg ?? 0) - (prevStats.avg ?? 0);
    const zScore = computeZScore(prev, entry, delta);
    comparisons.push({ label, prev: prevStats, curr: currStats, delta, zScore });
  }

  console.log(`[router bench compare] json: ${basename(pair.previous)} → ${basename(pair.latest)}`);
  if (!comparisons.length) {
    console.log('  공통 벤치마크가 없어 비교할 수 없습니다.');
  } else {
    const sorted = comparisons.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    console.table(sorted.map(({ label, prev, curr }) => buildTableRow(label, prev, curr)));
    const threshold = getZScoreThreshold();
    const flagged = sorted.filter(entry => entry.zScore !== undefined && Math.abs(entry.zScore) >= threshold);
    if (flagged.length) {
      console.log(`  통계적 경보 (|z| ≥ ${threshold}):`);
      for (const entry of flagged.slice(0, 12)) {
        const direction = entry.delta >= 0 ? 'regression' : 'improvement';
        console.log(`    - ${entry.label}: Δavg=${formatDelta(entry.delta)} (z=${formatZScore(entry.zScore!)}, ${direction})`);
      }
    }
  }
  if (newBenches.length) {
    console.log(`  신규 벤치마크 (${newBenches.length}): ${newBenches.join(', ')}`);
  }
  if (removed.size) {
    console.log(`  제거된 벤치마크 (${removed.size}): ${Array.from(removed).join(', ')}`);
  }
}

function compareCpuProfiles(): void {
  const pair = findArtifactPair('.cpuprofile');
  if (!pair) {
    console.log('[router bench compare] cpu-prof: 비교 가능한 이전 결과가 없습니다.');
    return;
  }
  const previousSize = statSync(pair.previous).size;
  const latestSize = statSync(pair.latest).size;
  const delta = latestSize - previousSize;
  const pct = previousSize === 0 ? null : (delta / previousSize) * 100;
  console.log(`[router bench compare] cpu-prof: ${basename(pair.previous)} → ${basename(pair.latest)}`);
  const direction = delta === 0 ? '변화 없음' : delta > 0 ? '더 큼' : '더 작음';
  const pctText = pct === null || !Number.isFinite(pct) ? '' : ` (${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%)`;
  console.log(`  파일 크기: ${formatBytes(previousSize)} → ${formatBytes(latestSize)} (${direction}${pctText})`);
  console.log('  flame graph 비교는 두 .cpuprofile 파일을 DevTools에 함께 로드해 확인하세요.');
}

function findArtifactPair(extension: string): ArtifactPair {
  const files = readdirSync(resultsDir)
    .filter(file => file.endsWith(extension))
    .sort();
  if (files.length < 2) {
    return undefined;
  }
  const latest = join(resultsDir, files[files.length - 1]!);
  const previous = join(resultsDir, files[files.length - 2]!);
  return { latest, previous };
}

function loadBenchmarks(filePath: string): BenchmarkEntry[] {
  const raw = readFileSync(filePath, 'utf8');
  const payload = extractJsonPayload(raw);
  if (!payload) {
    throw new Error(`[router bench compare] ${filePath} did not contain JSON payload.`);
  }
  const parsed = JSON.parse(payload) as BenchmarkFile | BenchmarkEntry[];
  if (Array.isArray(parsed)) {
    return parsed;
  }
  if (Array.isArray(parsed.results)) {
    return parsed.results;
  }
  if (Array.isArray(parsed.benchmarks)) {
    return parsed.benchmarks;
  }
  return [];
}

function makeBenchKey(entry: BenchmarkEntry): string {
  return `${entry.group ?? 'ungrouped'}::${entry.name}`;
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

function buildTableRow(label: string, prev: NumericStats, curr: NumericStats): Record<string, string> {
  const row: Record<string, string> = { benchmark: label };
  for (const metric of METRICS) {
    row[metric] = formatMetricCell(prev[metric], curr[metric]);
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
  const pctText = pct === null || !Number.isFinite(pct) ? '' : ` (${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%)`;
  return `${formatDuration(prevValue)} ${trend} ${formatDuration(currValue)}${pctText}`;
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

function getZScoreThreshold(): number {
  const raw = process.env.ROUTER_BENCH_Z;
  if (!raw) {
    return 2.5;
  }
  const value = Number(raw);
  return Number.isFinite(value) ? value : 2.5;
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
