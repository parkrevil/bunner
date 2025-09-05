#!/usr/bin/env bun

type LevelMetrics = {
  total_estimated_ns?: number | null;
  p50_latency_ns?: number | null;
  p99_latency_ns?: number | null;
  avg_latency_ns?: number | null;
  qps?: number | null;
  memory_bytes?: number | null;
  static_match_per_req?: number | null;
  router_cache?: { hit_rate?: number | null; miss_rate?: number | null } | null;
  cand_size?: {
    avg?: number | null;
    p50?: number | null;
    p99?: number | null;
  } | null;
  branch_mispredict_rate?: number | null;
  cache_hit_miss?: {
    l1?: number | null;
    l2?: number | null;
    l3?: number | null;
  } | null;
  memory_fragmentation?: number | null;
};

type SummaryByRoutes = Record<
  string,
  {
    register: { levels: Record<string, LevelMetrics> };
    lookup: { times: number; levels: Record<string, LevelMetrics> };
    lookup_miss: { times: number; levels: Record<string, LevelMetrics> };
  }
>;

function fmtNsHuman(v?: number | null): string {
  if (v == null || !isFinite(v)) {
    return '-';
  }
  if (v < 1e3) {
    return `${v.toFixed(2)} ns`;
  }
  if (v < 1e6) {
    return `${(v / 1e3).toFixed(2)} µs`;
  }
  if (v < 1e9) {
    return `${(v / 1e6).toFixed(2)} ms`;
  }
  return `${(v / 1e9).toFixed(2)} s`;
}

function fmtKMBNumber(n?: number | null): string {
  if (n == null || !isFinite(n)) {
    return '-';
  }
  const abs = Math.abs(n);
  const opts: Intl.NumberFormatOptions = {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  };
  if (abs >= 1_000_000_000) {
    return `${(n / 1_000_000_000).toLocaleString(undefined, opts)} B`;
  }
  if (abs >= 1_000_000) {
    return `${(n / 1_000_000).toLocaleString(undefined, opts)} M`;
  }
  if (abs >= 1_000) {
    return `${(n / 1_000).toLocaleString(undefined, opts)} K`;
  }
  return n.toLocaleString();
}

function fmtKMBWithUnit(v?: number | null, unit = ''): string {
  if (v == null || !isFinite(v)) {
    return '-';
  }
  const s = fmtKMBNumber(v);
  return unit ? `${s} ${unit.trim()}` : s;
}

function fmtPercent(v?: number | null, digits = 2): string {
  if (v == null || !isFinite(v)) {
    return '-';
  }
  return `${(v * 100).toFixed(digits)}%`;
}

function fmtBytesHuman(v?: number | null): string {
  if (v == null || !isFinite(v)) {
    return '-';
  }
  const n = v;
  if (Math.abs(n) < 64) {
    return '-';
  }
  const KB = 1024;
  const MB = KB * 1024;
  const GB = MB * 1024;
  const opts: Intl.NumberFormatOptions = {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  };
  if (n < KB) {
    return `${n.toLocaleString()} B`;
  }
  if (n < MB) {
    return `${(n / KB).toLocaleString(undefined, opts)} KB`;
  }
  if (n < GB) {
    return `${(n / MB).toLocaleString(undefined, opts)} MB`;
  }
  return `${(n / GB).toLocaleString(undefined, opts)} GB`;
}

function mdTableHeader(title: string): string {
  const head = title === 'Register' ? 'build/req' : 'req/s';
  const cols = [
    'Dataset',
    'Total Time',
    'p50 Latency',
    'p99 Latency',
    'Avg Latency',
    `Throughput (${head})`,
    'Memory',
    'Static/Req',
    'Cache Hit',
    'Cache Miss',
    'Cand Avg',
    'Cand p50',
    'Cand p99',
    'Branch Mispredict',
    'L1 Miss',
    'L2 Miss',
    'L3 Miss',
    'Fragmentation',
  ];
  const header = `| ${cols.join(' | ')} |\n`;
  const sep = `| ${cols.map((_, i) => (i === 0 ? '---' : '---:')).join(' | ')} |\n`;
  return `\n\n### ${title}\n\n${header}${sep}`;
}

function mdRow(name: string, m: LevelMetrics): string {
  const l1 = m.cache_hit_miss ? fmtPercent(m.cache_hit_miss.l1) : '-';
  const l2 = m.cache_hit_miss ? fmtPercent(m.cache_hit_miss.l2) : '-';
  const l3 = m.cache_hit_miss ? fmtPercent(m.cache_hit_miss.l3) : '-';
  const hit = m.router_cache ? fmtPercent(m.router_cache.hit_rate) : '-';
  const miss = m.router_cache ? fmtPercent(m.router_cache.miss_rate) : '-';
  const cavg = m.cand_size ? (m.cand_size.avg ?? null) : null;
  const cp50 = m.cand_size ? (m.cand_size.p50 ?? null) : null;
  const cp99 = m.cand_size ? (m.cand_size.p99 ?? null) : null;
  return `| ${name} | ${fmtNsHuman(m.total_estimated_ns)} | ${fmtNsHuman(m.p50_latency_ns)} | ${fmtNsHuman(m.p99_latency_ns)} | ${fmtNsHuman(m.avg_latency_ns)} | ${fmtKMBWithUnit(m.qps, 'req/s')} | ${fmtBytesHuman(m.memory_bytes)} | ${fmtKMBWithUnit(m.static_match_per_req, 'matches')} | ${hit} | ${miss} | ${fmtKMBNumber(cavg)} | ${fmtKMBNumber(cp50)} | ${fmtKMBNumber(cp99)} | ${fmtPercent(m.branch_mispredict_rate)} | ${l1} | ${l2} | ${l3} | ${fmtPercent(m.memory_fragmentation)} |\n`;
}

function nowStamp(): string {
  const d = new Date();
  const z = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}-${z(d.getHours())}${z(d.getMinutes())}${z(d.getSeconds())}`;
}

async function readText(p: string): Promise<string> {
  return await Bun.file(p).text();
}

async function writeText(p: string, content: string) {
  await Bun.write(p, content, { createPath: true });
}

async function main() {
  const cwd = process.cwd();
  let file: string | undefined = undefined;

  try {
    await Bun.file(
      `${cwd}/packages-ffi/http-server/target/benchmarks/http-server_router.json`,
    ).text();
    file = `${cwd}/packages-ffi/http-server/target/benchmarks/http-server_router.json`;
  } catch {}
  if (!file) {
    throw new Error('benchmark json not found');
  }

  const data = await readText(file);
  const s: SummaryByRoutes = JSON.parse(data);
  const levels = ['simple', 'medium', 'high', 'extreme'];
  let md = '# HTTP Server Router Benchmarks\n';
  const routeKeys = Object.keys(s).sort((a, b) => Number(a) - Number(b));
  for (const rk of routeKeys) {
    const entry = s[rk]!;
    const times = Number(entry.lookup?.times ?? 0);
    md += `\n## Routes: ${fmtKMBNumber(Number(rk))}\n\n- Lookup times: ${fmtKMBNumber(times)}\n`;

    md += mdTableHeader('Register');
    for (const lv of levels) {
      md += mdRow(lv, entry.register.levels?.[lv] ?? {});
    }

    md += mdTableHeader('Lookup');
    for (const lv of levels) {
      md += mdRow(lv, entry.lookup.levels?.[lv] ?? {});
    }

    md += mdTableHeader('Lookup (Miss case)');
    for (const lv of levels) {
      md += mdRow(lv, entry.lookup_miss.levels?.[lv] ?? {});
    }
  }

  const outPath = `${cwd}/benchmarks/http-server_router_${nowStamp()}.md`;
  await writeText(outPath, md);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
