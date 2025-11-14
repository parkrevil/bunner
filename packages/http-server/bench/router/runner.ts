import { mkdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

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
