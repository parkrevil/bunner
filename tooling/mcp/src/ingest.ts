import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import { sql } from 'drizzle-orm';

import { createDb } from './db';
import { readEnv } from './env';
import { readQuery } from './queries';
import { createKb } from './kb';
import { parseSpecMarkdown } from './spec-parser';

type OnlyMode = 'specs' | 'code' | 'tests' | 'all';

type CliOptions = {
  dryRun: boolean;
  only: OnlyMode;
  repoRev?: string;
  sinceRev?: string;
  toolVersion: string;
};

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    dryRun: false,
    only: 'all',
    toolVersion: '0.1.0',
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--only') {
      const value = argv[i + 1] as OnlyMode | undefined;
      if (!value || !['specs', 'code', 'tests', 'all'].includes(value)) {
        throw new Error(`Invalid --only value: ${String(value)}`);
      }
      options.only = value;
      i++;
    } else if (arg === '--rev') {
      const value = argv[i + 1];
      if (!value) throw new Error('Missing value for --rev');
      options.repoRev = value;
      i++;
    } else if (arg === '--since') {
      const value = argv[i + 1];
      if (!value) throw new Error('Missing value for --since');
      options.sinceRev = value;
      i++;
    } else if (arg === '--tool-version') {
      options.toolVersion = argv[i + 1] ?? options.toolVersion;
      i++;
    } else if (arg === '--help') {
      // eslint-disable-next-line no-console
      console.log(
        `Usage: bun tooling/mcp/src/ingest.ts [--dry-run] [--only specs|code|tests|all] [--rev <gitrev>] [--since <gitrev>]\n`,
      );
      process.exit(0);
    }
  }

  return options;
}

function getRepoRevFallback(): string {
  try {
    const proc = Bun.spawnSync(['git', 'rev-parse', 'HEAD'], { stdout: 'pipe', stderr: 'pipe' });
    const out = proc.stdout?.toString().trim();
    if (out) return out;
  } catch {
    // ignore
  }
  return 'unknown';
}

function computeChangedPaths(params: {
  sinceRev: string;
  repoRev: string;
  pathspecs: string[];
}): Set<string> | null {
  try {
    const range = `${params.sinceRev}..${params.repoRev}`;
    const proc = Bun.spawnSync(
      ['git', 'diff', '--name-only', '--diff-filter=ACMR', range, '--', ...params.pathspecs],
      { stdout: 'pipe', stderr: 'pipe' },
    );
    const out = proc.stdout?.toString() ?? '';
    const paths = out
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    return new Set(paths);
  } catch {
    return null;
  }
}

async function listFilesRecursive(rootDir: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else out.push(full);
    }
  }
  await walk(rootDir);
  return out;
}

async function ingestSpecs(params: {
  kb: ReturnType<typeof createKb>;
  runId: number;
  repoRev: string;
  dryRun: boolean;
  changedPaths?: Set<string> | null;
}): Promise<{ specs: number; rules: number; diagnostics: number; edges: number }>
{
  const specRoot = path.resolve(process.cwd(), 'docs/30_SPEC');
  const files = (await listFilesRecursive(specRoot)).filter((f) => f.endsWith('.spec.md'));

  const parsedByPath = new Map<string, { specId: string; dependsOn: string[] }>();
  const parsedById = new Map<string, { relPath: string; dependsOn: string[] }>();

  // Pass 1: identity map
  for (const abs of files) {
    const rel = path.relative(process.cwd(), abs).replaceAll(path.sep, '/');
    const text = await fs.readFile(abs, 'utf8');
    const parsed = parseSpecMarkdown(text);
    const specId = parsed.identity.id?.trim();
    if (!specId) continue;
    parsedByPath.set(rel, { specId, dependsOn: parsed.identity.dependsOn });
    parsedById.set(specId, { relPath: rel, dependsOn: parsed.identity.dependsOn });
  }

  let specs = 0;
  let rules = 0;
  let diagnostics = 0;
  let edges = 0;

  for (const abs of files) {
    const rel = path.relative(process.cwd(), abs).replaceAll(path.sep, '/');
    if (params.changedPaths && !params.changedPaths.has(rel)) continue;
    const text = await fs.readFile(abs, 'utf8');
    const parsed = parseSpecMarkdown(text);

    const specId = parsed.identity.id?.trim() ?? `UNKNOWN:${rel}`;
    const title = parsed.identity.title?.trim() ?? specId;

    if (params.dryRun) {
      specs++;
      rules += parsed.rules.length;
      diagnostics += parsed.diagnostics.length;
      continue;
    }

    await params.kb.ensureType('entity_type', 'spec');
    await params.kb.ensureType('entity_type', 'rule');

    const specPointerId = await params.kb.upsertPointer({ kind: 'file', repoPath: rel, rev: params.repoRev });
    const specEntityId = await params.kb.upsertEntity(
      {
        entityKey: `spec:${specId}`,
        entityType: 'spec',
        displayName: title,
        summaryText: `${title} (${specId})`,
        pointerId: specPointerId,
        meta: {
          version: parsed.identity.version,
          status: parsed.identity.status,
          owner: parsed.identity.owner,
          uniquenessScope: parsed.identity.uniquenessScope,
        },
      },
      params.runId,
    );

    await params.kb.upsertChunk({
      entityId: specEntityId,
      chunkType: 'summary',
      chunkKey: 'identity',
      payloadJson: {
        ...parsed.identity,
        inScope: parsed.inScope,
        outOfScope: parsed.outOfScope,
      },
      payloadText: [
        `SPEC ${specId}: ${title}`,
        parsed.identity.status ? `status: ${parsed.identity.status}` : '',
        parsed.inScope.length ? `in-scope: ${parsed.inScope.join(' | ')}` : '',
        parsed.outOfScope.length ? `out-of-scope: ${parsed.outOfScope.join(' | ')}` : '',
      ]
        .filter((v) => v.length > 0)
        .join('\n'),
      pointerId: specPointerId,
      ingestRunId: params.runId,
    });

    specs++;

    // depends_on edges (spec->spec only, best effort)
    for (const dep of parsed.identity.dependsOn) {
      const depSpecId = dep.startsWith('path:')
        ? parsedByPath.get(dep.slice('path:'.length))?.specId
        : dep.startsWith('doc:')
          ? dep.slice('doc:'.length)
          : undefined;

      if (!depSpecId) continue;

      const depInfo = parsedById.get(depSpecId);
      const depPointerId = depInfo
        ? await params.kb.upsertPointer({ kind: 'file', repoPath: depInfo.relPath, rev: params.repoRev })
        : undefined;

      const depEntityId = await params.kb.upsertEntity(
        {
          entityKey: `spec:${depSpecId}`,
          entityType: 'spec',
          displayName: depSpecId,
          summaryText: depSpecId,
          ...(typeof depPointerId === 'number' ? { pointerId: depPointerId } : {}),
        },
        params.runId,
      );

      await params.kb.upsertEdge({
        srcEntityId: specEntityId,
        dstEntityId: depEntityId,
        edgeType: 'depends_on',
        strength: 'contract',
        pointerId: specPointerId,
        ingestRunId: params.runId,
        meta: { ref: dep },
      });
      edges++;
    }

    // Rules
    for (const rule of parsed.rules) {
      const ruleEntityId = await params.kb.upsertEntity(
        {
          entityKey: `rule:${rule.ruleId}`,
          entityType: 'rule',
          displayName: rule.ruleId,
          summaryText: `${rule.keyword ?? ''} ${rule.enforcedLevel ?? ''}`.trim(),
          pointerId: specPointerId,
          meta: { ...rule, specId },
        },
        params.runId,
      );

      await params.kb.upsertEdge({
        srcEntityId: specEntityId,
        dstEntityId: ruleEntityId,
        edgeType: 'relates_to',
        strength: 'contract',
        pointerId: specPointerId,
        ingestRunId: params.runId,
      });

      await params.kb.upsertChunk({
        entityId: ruleEntityId,
        chunkType: 'behavior',
        chunkKey: `rule:${rule.ruleId}`,
        payloadJson: { ...rule, specId },
        payloadText: [
          rule.ruleId,
          rule.keyword ? `keyword: ${rule.keyword}` : '',
          rule.enforcedLevel ? `level: ${rule.enforcedLevel}` : '',
          rule.targets ? `targets: ${rule.targets}` : '',
          rule.targetRefs ? `refs: ${rule.targetRefs}` : '',
          rule.condition ? `condition: ${rule.condition}` : '',
        ]
          .filter((v) => v.length > 0)
          .join('\n'),
        pointerId: specPointerId,
        ingestRunId: params.runId,
      });

      rules++;
    }

    // Diagnostics
    for (const diag of parsed.diagnostics) {
      const diagPointerId = await params.kb.upsertPointer({ kind: 'file', repoPath: rel, rev: params.repoRev });
      const diagEntityId = await params.kb.upsertEntity(
        {
          entityKey: `diag:${diag.diagnosticCode}`,
          entityType: 'diagnostic',
          displayName: diag.diagnosticCode,
          summaryText: diag.violation ?? diag.diagnosticCode,
          pointerId: diagPointerId,
          meta: { ...diag, specId },
        },
        params.runId,
      );

      await params.kb.upsertChunk({
        entityId: diagEntityId,
        chunkType: 'diagnostic',
        chunkKey: `diag:${diag.diagnosticCode}`,
        payloadJson: { ...diag, specId },
        payloadText: [
          diag.diagnosticCode,
          diag.ruleId ? `rule: ${diag.ruleId}` : '',
          diag.severity ? `severity: ${diag.severity}` : '',
          diag.where ? `where: ${diag.where}` : '',
          diag.howDetectable ? `how: ${diag.howDetectable}` : '',
          diag.violation ? `violation: ${diag.violation}` : '',
        ]
          .filter((v) => v.length > 0)
          .join('\n'),
        pointerId: diagPointerId,
        ingestRunId: params.runId,
      });

      // Link rule -> diagnostic when possible
      if (diag.ruleId) {
        const ruleEntityId = await params.kb.upsertEntity(
          {
            entityKey: `rule:${diag.ruleId}`,
            entityType: 'rule',
            displayName: diag.ruleId,
            summaryText: diag.ruleId,
            pointerId: specPointerId,
          },
          params.runId,
        );

        await params.kb.upsertEdge({
          srcEntityId: ruleEntityId,
          dstEntityId: diagEntityId,
          edgeType: 'triggers',
          strength: 'contract',
          pointerId: diagPointerId,
          ingestRunId: params.runId,
        });
        edges++;
      }

      diagnostics++;
    }
  }

  return { specs, rules, diagnostics, edges };
}

async function ingestCodeIndex(params: {
  kb: ReturnType<typeof createKb>;
  runId: number;
  repoRev: string;
  dryRun: boolean;
  changedPaths?: Set<string> | null;
}): Promise<{ packages: number; chunks: number }>
{
  const packagesDir = path.resolve(process.cwd(), 'packages');
  const entries = await fs.readdir(packagesDir, { withFileTypes: true });

  let packages = 0;
  let chunks = 0;

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const pkgDir = path.join(packagesDir, entry.name);
    const pkgJsonPath = path.join(pkgDir, 'package.json');
    const pkgJsonRel = path
      .relative(process.cwd(), pkgJsonPath)
      .replaceAll(path.sep, '/');

    if (params.changedPaths && !params.changedPaths.has(pkgJsonRel)) continue;

    try {
      const pkgJsonText = await fs.readFile(pkgJsonPath, 'utf8');
      const pkgJson = JSON.parse(pkgJsonText) as Record<string, unknown>;
      const name = typeof pkgJson.name === 'string' ? pkgJson.name : entry.name;
      const description = typeof pkgJson.description === 'string' ? pkgJson.description : '';
      const exportsField = pkgJson.exports;

      if (params.dryRun) {
        packages++;
        continue;
      }

      const pointerId = await params.kb.upsertPointer({ kind: 'file', repoPath: path.relative(process.cwd(), pkgJsonPath), rev: params.repoRev });
      const entityId = await params.kb.upsertEntity(
        {
          entityKey: `pkg:${name}`,
          entityType: 'package',
          packageName: name,
          displayName: name,
          summaryText: description,
          pointerId,
        },
        params.runId,
      );

      await params.kb.upsertChunk({
        entityId,
        chunkType: 'summary',
        chunkKey: 'package.json',
        payloadJson: { name, description, exports: exportsField ?? null },
        payloadText: [`package ${name}`, description, exportsField ? 'has exports map' : 'no exports map']
          .filter((v) => v.length > 0)
          .join('\n'),
        pointerId,
        ingestRunId: params.runId,
      });
      chunks++;

      packages++;
    } catch {
      // ignore directories without package.json
    }
  }

  return { packages, chunks };
}

async function ingestTests(params: {
  kb: ReturnType<typeof createKb>;
  runId: number;
  repoRev: string;
  dryRun: boolean;
  changedPaths?: Set<string> | null;
}): Promise<{ tests: number }>
{
  const root = process.cwd();
  const allFiles = await listFilesRecursive(path.resolve(root, 'packages'));
  const testFiles = allFiles
    .map((abs) => path.relative(root, abs).replaceAll(path.sep, '/'))
    .filter((rel) => rel.endsWith('.spec.ts') || rel.includes('/test/') || rel.endsWith('.test.ts'));

  const effectiveTestFiles = params.changedPaths
    ? testFiles.filter((rel) => params.changedPaths?.has(rel))
    : testFiles;

  if (params.dryRun) return { tests: effectiveTestFiles.length };

  let tests = 0;
  for (const rel of effectiveTestFiles) {
    const pointerId = await params.kb.upsertPointer({ kind: 'file', repoPath: rel, rev: params.repoRev });
    await params.kb.upsertEntity(
      {
        entityKey: `test:${rel}`,
        entityType: 'test_case',
        displayName: path.basename(rel),
        summaryText: rel,
        pointerId,
      },
      params.runId,
    );
    tests++;
  }

  return { tests };
}

async function main() {
  const options = parseArgs(process.argv);
  const repoRev = options.repoRev ?? getRepoRevFallback();

  const changedPaths = options.sinceRev
    ? computeChangedPaths({
        sinceRev: options.sinceRev,
        repoRev,
        pathspecs: ['docs/30_SPEC', 'packages'],
      })
    : null;

  if (options.dryRun) {
    // eslint-disable-next-line no-console
    console.log(
      `[kb] dry-run: scanning only (rev=${repoRev}, only=${options.only}${options.sinceRev ? `, since=${options.sinceRev}` : ''})`,
    );
  }

  if (options.dryRun) {
    const fake = {
      ensureType: async () => 0,
      upsertPointer: async () => 0,
      upsertEntity: async () => 0,
      upsertChunk: async () => 0,
      upsertEdge: async () => 0,
      beginRun: async () => 0,
      finishRun: async () => {},
    } as unknown as ReturnType<typeof createKb>;

    const runId = 0;

    if (options.only === 'specs' || options.only === 'all') {
      const res = await ingestSpecs({ kb: fake, runId, repoRev, dryRun: true, changedPaths });
      // eslint-disable-next-line no-console
      console.log('[kb] specs', res);
    }
    if (options.only === 'code' || options.only === 'all') {
      const res = await ingestCodeIndex({ kb: fake, runId, repoRev, dryRun: true, changedPaths });
      // eslint-disable-next-line no-console
      console.log('[kb] code', res);
    }
    if (options.only === 'tests' || options.only === 'all') {
      const res = await ingestTests({ kb: fake, runId, repoRev, dryRun: true, changedPaths });
      // eslint-disable-next-line no-console
      console.log('[kb] tests', res);
    }

    return;
  }

  const env = readEnv(process.env);

  const db = await createDb(env.BUNNER_KB_DATABASE_URL);

  // Ensure schema exists
  await db.execute(sql.raw(await readQuery('001_extensions')));
  await db.execute(sql.raw(await readQuery('010_kb_schema')));

  const kb = createKb(db);

  const runId = await kb.beginRun({
    repoRev,
    tool: 'kb-ingest',
    toolVersion: options.toolVersion,
    meta: {
      only: options.only,
      ...(options.sinceRev ? { since: options.sinceRev } : {}),
      ...(changedPaths ? { changedCount: changedPaths.size } : {}),
    },
  });

  try {
    const meta: Record<string, unknown> = {};

    if (options.only === 'specs' || options.only === 'all') {
      meta.specs = await ingestSpecs({ kb, runId, repoRev, dryRun: false, changedPaths });
    }
    if (options.only === 'code' || options.only === 'all') {
      meta.code = await ingestCodeIndex({ kb, runId, repoRev, dryRun: false, changedPaths });
    }
    if (options.only === 'tests' || options.only === 'all') {
      meta.tests = await ingestTests({ kb, runId, repoRev, dryRun: false, changedPaths });
    }

    await kb.finishRun(runId, 'succeeded', meta);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await kb.finishRun(runId, 'failed', { error: message });
    throw error;
  }
}

await main();
