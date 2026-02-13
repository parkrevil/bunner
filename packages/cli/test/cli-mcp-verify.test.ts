import { afterEach, beforeEach, describe, expect, it } from 'bun:test';

import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'path';

const bunnerBinPath = Bun.fileURLToPath(new URL('../src/bin/bunner.ts', import.meta.url));

interface DiagnosticPayload {
  severity: string;
  code: string;
  summary: string;
}

function getTmpDir(): string {
  return process.env.TMPDIR ?? process.env.TEMP ?? process.env.TMP ?? '/tmp';
}

async function makeTempDir(prefix: string): Promise<string> {
  const dir = join(getTmpDir(), `${prefix}${crypto.randomUUID()}`);
  await mkdir(dir, { recursive: true });
  return dir;
}

function parseDiagnostics(stderr: string): DiagnosticPayload[] {
  const withoutAnsi = stderr.replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '');
  const trimmed = withoutAnsi.trim();
  if (trimmed.length === 0) return [];

  const jsonStart = trimmed.indexOf('[');
  const jsonEnd = trimmed.lastIndexOf(']');
  if (jsonStart === -1 || jsonEnd === -1 || jsonEnd < jsonStart) {
    throw new Error('Expected diagnostics payload to contain a JSON array.');
  }

  const jsonSlice = trimmed.slice(jsonStart, jsonEnd + 1);
  const parsed = JSON.parse(jsonSlice) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error('Expected diagnostics payload to be a JSON array.');
  }

  return parsed as DiagnosticPayload[];
}

function expectHasCode(diags: DiagnosticPayload[], code: string): void {
  expect(diags.some((d) => d.code === code)).toBe(true);
}

function expectNotHasCode(diags: DiagnosticPayload[], code: string): void {
  expect(diags.some((d) => d.code === code)).toBe(false);
}

async function writeText(path: string, text: string) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, text, 'utf8');
}

async function runVerify(projectRoot: string): Promise<{ exitCode: number; stdout: string; stderr: string; diagnostics: DiagnosticPayload[] }> {
  const proc = Bun.spawn({
    cmd: ['bun', bunnerBinPath, 'mcp', 'verify'],
    cwd: projectRoot,
    stdout: 'pipe',
    stderr: 'pipe',
  });

  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;
  const diagnostics = parseDiagnostics(stderr);

  return { exitCode, stdout, stderr, diagnostics };
}

describe('cli — bunner mcp verify', () => {
  let projectRoot: string | null = null;

  beforeEach(async () => {
    projectRoot = await makeTempDir('bunner_cli_p5_');

    await writeText(join(projectRoot, 'bunner.json'), defaultConfigJson());
    await writeText(join(projectRoot, 'src', 'main.ts'), `export const main = 1;\n`);
  });

  afterEach(async () => {
    if (projectRoot) {
      await rm(projectRoot, { recursive: true, force: true });
      projectRoot = null;
    }
  });

  function defaultConfigJson(overrides?: {
    types?: string[];
    relations?: string[];
    exclude?: string[];
  }): string {
    return (
      JSON.stringify(
        {
          module: { fileName: 'module.ts' },
          sourceDir: './src',
          entry: './src/main.ts',
          mcp: {
            card: {
              types: overrides?.types ?? ['spec'],
              relations: overrides?.relations ?? ['depends_on', 'references', 'related', 'extends', 'conflicts'],
            },
            exclude: overrides?.exclude ?? [],
          },
        },
        null,
        2,
      ) + '\n'
    );
  }

  it('exits 1 and reports SEE_TARGET_MISSING when code @see points to a missing card', async () => {
    await writeText(
      join(projectRoot!, '.bunner', 'cards', 'a.card.md'),
      `---\nkey: spec::a\ntype: spec\nsummary: A\nstatus: draft\n---\nBody\n`,
    );

    await writeText(
      join(projectRoot!, 'src', 'x.ts'),
      `/**\n * @see spec::missing\n */\nexport function x() {}\n`,
    );

    const { exitCode, stdout, diagnostics } = await runVerify(projectRoot!);

    expect(exitCode).toBe(1);
    expect(stdout.length).toBeGreaterThanOrEqual(0);
    expectHasCode(diagnostics, 'MCP_VERIFY_SEE_TARGET_MISSING');
    expectNotHasCode(diagnostics, 'INVALID_COMMAND');
  });

  it('exits 0 and reports DEPENDS_ON_CYCLE when card depends_on cycle is detected', async () => {
    await writeText(
      join(projectRoot!, '.bunner', 'cards', 'a.card.md'),
      `---\nkey: spec::a\ntype: spec\nsummary: A\nstatus: draft\nrelations:\n  - type: depends_on\n    target: spec::b\n---\nBody\n`,
    );

    await writeText(
      join(projectRoot!, '.bunner', 'cards', 'b.card.md'),
      `---\nkey: spec::b\ntype: spec\nsummary: B\nstatus: draft\nrelations:\n  - type: depends_on\n    target: spec::a\n---\nBody\n`,
    );

    const { exitCode, diagnostics } = await runVerify(projectRoot!);

    expect(exitCode).toBe(0);
    expectHasCode(diagnostics, 'MCP_VERIFY_DEPENDS_ON_CYCLE');
    expectNotHasCode(diagnostics, 'INVALID_COMMAND');
  });

  it('exits 0 and prints no diagnostics when verify passes', async () => {
    await writeText(
      join(projectRoot!, '.bunner', 'cards', 'a.card.md'),
      `---\nkey: spec::a\ntype: spec\nsummary: A\nstatus: draft\n---\nBody\n`,
    );

    await writeText(
      join(projectRoot!, 'src', 'a.ts'),
      `/**\n * @see spec::a\n */\nexport function a() {}\n`,
    );

    const { exitCode, diagnostics } = await runVerify(projectRoot!);

    expect(exitCode).toBe(0);
    expect(diagnostics).toEqual([]);
  });

  it('exits 1 and reports CARD_KEY_DUPLICATE when two card files declare the same key', async () => {
    await writeText(
      join(projectRoot!, '.bunner', 'cards', 'a.card.md'),
      `---\nkey: spec::dup\ntype: spec\nsummary: A\nstatus: draft\n---\nBody\n`,
    );

    await writeText(
      join(projectRoot!, '.bunner', 'cards', 'b.card.md'),
      `---\nkey: spec::dup\ntype: spec\nsummary: B\nstatus: draft\n---\nBody\n`,
    );

    const { exitCode, diagnostics } = await runVerify(projectRoot!);

    expect(exitCode).toBe(1);
    expectHasCode(diagnostics, 'MCP_VERIFY_CARD_KEY_DUPLICATE');
  });

  it('exits 1 and reports CARD_TYPE_NOT_ALLOWED when card.type is not allowed by config', async () => {
    await writeText(join(projectRoot!, 'bunner.json'), defaultConfigJson({ types: ['spec'] }));

    await writeText(
      join(projectRoot!, '.bunner', 'cards', 'a.card.md'),
      `---\nkey: spec::a\ntype: system\nsummary: A\nstatus: draft\n---\nBody\n`,
    );

    const { exitCode, diagnostics } = await runVerify(projectRoot!);

    expect(exitCode).toBe(1);
    expectHasCode(diagnostics, 'MCP_VERIFY_CARD_TYPE_NOT_ALLOWED');
  });

  it('exits 1 and reports RELATION_TARGET_MISSING when a relation points to a missing card', async () => {
    await writeText(
      join(projectRoot!, '.bunner', 'cards', 'a.card.md'),
      `---\nkey: spec::a\ntype: spec\nsummary: A\nstatus: draft\nrelations:\n  - type: depends_on\n    target: spec::missing\n---\nBody\n`,
    );

    const { exitCode, diagnostics } = await runVerify(projectRoot!);

    expect(exitCode).toBe(1);
    expectHasCode(diagnostics, 'MCP_VERIFY_RELATION_TARGET_MISSING');
  });

  it('exits 1 and reports RELATION_TYPE_NOT_ALLOWED when a relation type is not allowed by config', async () => {
    await writeText(join(projectRoot!, 'bunner.json'), defaultConfigJson({ relations: ['depends_on'] }));

    await writeText(
      join(projectRoot!, '.bunner', 'cards', 'a.card.md'),
      `---\nkey: spec::a\ntype: spec\nsummary: A\nstatus: draft\nrelations:\n  - type: references\n    target: spec::b\n---\nBody\n`,
    );
    await writeText(
      join(projectRoot!, '.bunner', 'cards', 'b.card.md'),
      `---\nkey: spec::b\ntype: spec\nsummary: B\nstatus: draft\n---\nBody\n`,
    );

    const { exitCode, diagnostics } = await runVerify(projectRoot!);

    expect(exitCode).toBe(1);
    expectHasCode(diagnostics, 'MCP_VERIFY_RELATION_TYPE_NOT_ALLOWED');
  });

  it('exits 1 and reports RELATION_TARGET_TYPE_MISMATCH when relation target prefix mismatches target card.type', async () => {
    await writeText(join(projectRoot!, 'bunner.json'), defaultConfigJson({ types: ['spec', 'system'] }));

    await writeText(
      join(projectRoot!, '.bunner', 'cards', 'a.card.md'),
      `---\nkey: spec::a\ntype: spec\nsummary: A\nstatus: draft\nrelations:\n  - type: depends_on\n    target: spec::b\n---\nBody\n`,
    );
    await writeText(
      join(projectRoot!, '.bunner', 'cards', 'b.card.md'),
      `---\nkey: spec::b\ntype: system\nsummary: B\nstatus: draft\n---\nBody\n`,
    );

    const { exitCode, diagnostics } = await runVerify(projectRoot!);

    expect(exitCode).toBe(1);
    expectHasCode(diagnostics, 'MCP_VERIFY_RELATION_TARGET_TYPE_MISMATCH');
  });

  it('exits 1 and reports SEE_TYPE_MISMATCH when @see prefix mismatches target card.type', async () => {
    await writeText(join(projectRoot!, 'bunner.json'), defaultConfigJson({ types: ['spec', 'system'] }));

    await writeText(
      join(projectRoot!, '.bunner', 'cards', 'a.card.md'),
      `---\nkey: spec::a\ntype: system\nsummary: A\nstatus: draft\n---\nBody\n`,
    );
    await writeText(
      join(projectRoot!, 'src', 'x.ts'),
      `/**\n * @see spec::a\n */\nexport function x() {}\n`,
    );

    const { exitCode, diagnostics } = await runVerify(projectRoot!);

    expect(exitCode).toBe(1);
    expectHasCode(diagnostics, 'MCP_VERIFY_SEE_TYPE_MISMATCH');
  });

  it('exits 1 and reports IMPLEMENTED_CARD_NO_CODE_LINKS when status=implemented has no @see references', async () => {
    await writeText(
      join(projectRoot!, '.bunner', 'cards', 'a.card.md'),
      `---\nkey: spec::a\ntype: spec\nsummary: A\nstatus: implemented\n---\nBody\n`,
    );

    const { exitCode, diagnostics } = await runVerify(projectRoot!);

    expect(exitCode).toBe(1);
    expectHasCode(diagnostics, 'MCP_VERIFY_IMPLEMENTED_CARD_NO_CODE_LINKS');
  });

  it('exits 0 and reports CONFIRMED_CARD_NO_CODE_LINKS when status=accepted has no @see references', async () => {
    await writeText(
      join(projectRoot!, '.bunner', 'cards', 'a.card.md'),
      `---\nkey: spec::a\ntype: spec\nsummary: A\nstatus: accepted\n---\nBody\n`,
    );

    const { exitCode, diagnostics } = await runVerify(projectRoot!);

    expect(exitCode).toBe(0);
    expectHasCode(diagnostics, 'MCP_VERIFY_CONFIRMED_CARD_NO_CODE_LINKS');
  });

  it('exits 0 and reports REFERENCES_DEPRECATED_CARD when a deprecated card is referenced', async () => {
    await writeText(
      join(projectRoot!, '.bunner', 'cards', 'a.card.md'),
      `---\nkey: spec::a\ntype: spec\nsummary: A\nstatus: draft\nrelations:\n  - type: references\n    target: spec::b\n---\nBody\n`,
    );
    await writeText(
      join(projectRoot!, '.bunner', 'cards', 'b.card.md'),
      `---\nkey: spec::b\ntype: spec\nsummary: B\nstatus: deprecated\n---\nBody\n`,
    );

    const { exitCode, diagnostics } = await runVerify(projectRoot!);

    expect(exitCode).toBe(0);
    expectHasCode(diagnostics, 'MCP_VERIFY_REFERENCES_DEPRECATED_CARD');
  });

  it('does not report @see errors for excluded code paths', async () => {
    await writeText(join(projectRoot!, 'bunner.json'), defaultConfigJson({ exclude: ['src/excluded/**'] }));

    await writeText(
      join(projectRoot!, '.bunner', 'cards', 'a.card.md'),
      `---\nkey: spec::a\ntype: spec\nsummary: A\nstatus: draft\n---\nBody\n`,
    );
    await writeText(
      join(projectRoot!, 'src', 'excluded', 'x.ts'),
      `/**\n * @see spec::missing\n */\nexport function x() {}\n`,
    );

    const { exitCode, diagnostics } = await runVerify(projectRoot!);

    expect(exitCode).toBe(0);
    expect(diagnostics).toEqual([]);
  });
});
