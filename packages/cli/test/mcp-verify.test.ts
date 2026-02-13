import { afterEach, beforeEach, describe, expect, it } from 'bun:test';

import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'path';

import type { ResolvedBunnerConfig } from '../src/common/interfaces';

import { verifyProject } from '../src/mcp/verify/verify-project';

const config: ResolvedBunnerConfig = {
  module: { fileName: 'module.ts' },
  sourceDir: './src',
  entry: './src/main.ts',
  mcp: {
    card: { types: ['spec'], relations: ['depends_on', 'references', 'related', 'extends', 'conflicts'] },
    exclude: [],
  },
};

describe('mcp/verify — verifyProject (P5)', () => {
  let projectRoot: string | null = null;

  async function writeText(path: string, text: string) {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, text, 'utf8');
  }

  beforeEach(async () => {
    projectRoot = await mkdtemp(join(tmpdir(), 'bunner_p5_'));
  });

  afterEach(async () => {
    if (projectRoot) {
      await rm(projectRoot, { recursive: true, force: true });
      projectRoot = null;
    }
  });

  it('errors when code references a non-existent card via @see', async () => {
    await writeText(
      join(projectRoot!, '.bunner', 'cards', 'auth', 'login.card.md'),
      `---\nkey: spec::auth/login\ntype: spec\nsummary: Login\nstatus: draft\n---\nBody\n`,
    );

    await writeText(
      join(projectRoot!, 'src', 'x.ts'),
      `/**\n * @see spec::does/not-exist\n */\nexport function x() {}\n`,
    );

    const res = await verifyProject({ projectRoot: projectRoot!, config });
    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => e.code === 'SEE_TARGET_MISSING')).toBe(true);
  });

  it('errors when @see type prefix does not match target card.type', async () => {
    await writeText(
      join(projectRoot!, '.bunner', 'cards', 'a.card.md'),
      `---\nkey: system::a\ntype: spec\nsummary: A\nstatus: draft\n---\nBody\n`,
    );
    await writeText(
      join(projectRoot!, 'src', 'a.ts'),
      `/**\n * @see system::a\n */\nexport function a() {}\n`,
    );

    const res = await verifyProject({ projectRoot: projectRoot!, config });
    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => e.code === 'SEE_TYPE_MISMATCH')).toBe(true);
  });

  it('errors when a card has status implemented but has no @see references', async () => {
    await writeText(
      join(projectRoot!, '.bunner', 'cards', 'impl.card.md'),
      `---\nkey: spec::impl\ntype: spec\nsummary: Impl\nstatus: implemented\n---\nBody\n`,
    );
    await writeText(join(projectRoot!, 'src', 'noop.ts'), `export const noop = 1;\n`);

    const res = await verifyProject({ projectRoot: projectRoot!, config });
    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => e.code === 'IMPLEMENTED_CARD_NO_CODE_LINKS')).toBe(true);
  });

  it('warns when a card is accepted/implementing but has no @see references', async () => {
    await writeText(
      join(projectRoot!, '.bunner', 'cards', 'acc.card.md'),
      `---\nkey: spec::acc\ntype: spec\nsummary: Acc\nstatus: accepted\n---\nBody\n`,
    );
    await writeText(join(projectRoot!, 'src', 'noop.ts'), `export const noop = 1;\n`);

    const res = await verifyProject({ projectRoot: projectRoot!, config });
    expect(res.ok).toBe(true);
    expect(res.warnings.some((w) => w.code === 'CONFIRMED_CARD_NO_CODE_LINKS')).toBe(true);
  });

  it('errors when card.type is not in config.mcp.card.types', async () => {
    await writeText(
      join(projectRoot!, '.bunner', 'cards', 'bad-type.card.md'),
      `---\nkey: system::x\ntype: system\nsummary: X\nstatus: draft\n---\nBody\n`,
    );

    const res = await verifyProject({ projectRoot: projectRoot!, config });
    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => e.code === 'CARD_TYPE_NOT_ALLOWED')).toBe(true);
  });

  it('errors when a frontmatter relation targets a missing card or uses disallowed relation type', async () => {
    await writeText(
      join(projectRoot!, '.bunner', 'cards', 'a.card.md'),
      `---\nkey: spec::a\ntype: spec\nsummary: A\nstatus: draft\nrelations:\n  - type: depends_on\n    target: spec::missing\n  - type: not_allowed\n    target: spec::a\n---\nBody\n`,
    );

    const res = await verifyProject({ projectRoot: projectRoot!, config });
    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => e.code === 'RELATION_TARGET_MISSING')).toBe(true);
    expect(res.errors.some((e) => e.code === 'RELATION_TYPE_NOT_ALLOWED')).toBe(true);
  });

  it('warns on depends_on cycles', async () => {
    await writeText(
      join(projectRoot!, '.bunner', 'cards', 'a.card.md'),
      `---\nkey: spec::a\ntype: spec\nsummary: A\nstatus: draft\nrelations:\n  - type: depends_on\n    target: spec::b\n---\nBody\n`,
    );
    await writeText(
      join(projectRoot!, '.bunner', 'cards', 'b.card.md'),
      `---\nkey: spec::b\ntype: spec\nsummary: B\nstatus: draft\nrelations:\n  - type: depends_on\n    target: spec::a\n---\nBody\n`,
    );

    const res = await verifyProject({ projectRoot: projectRoot!, config });
    expect(res.ok).toBe(true);
    expect(res.warnings.some((w) => w.code === 'DEPENDS_ON_CYCLE')).toBe(true);
  });

  it('warns on references to deprecated cards (via @see or relations)', async () => {
    await writeText(
      join(projectRoot!, '.bunner', 'cards', 'dep.card.md'),
      `---\nkey: spec::dep\ntype: spec\nsummary: Dep\nstatus: deprecated\n---\nBody\n`,
    );
    await writeText(
      join(projectRoot!, '.bunner', 'cards', 'a.card.md'),
      `---\nkey: spec::a\ntype: spec\nsummary: A\nstatus: draft\nrelations:\n  - type: references\n    target: spec::dep\n---\nBody\n`,
    );
    await writeText(
      join(projectRoot!, 'src', 'a.ts'),
      `/**\n * @see spec::dep\n */\nexport function a() {}\n`,
    );

    const res = await verifyProject({ projectRoot: projectRoot!, config });
    expect(res.ok).toBe(true);
    expect(res.warnings.some((w) => w.code === 'REFERENCES_DEPRECATED_CARD')).toBe(true);
  });
});
