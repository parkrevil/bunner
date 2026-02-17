import { afterEach, describe, expect, it } from 'bun:test';

import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

import { eq } from 'drizzle-orm';

import { createDb, closeDb } from '../../store/connection';
import { card } from '../../store/schema';

import { indexProject } from './index-project';

describe('indexProject', () => {
  const tempRoots: string[] = [];

  afterEach(() => {
    for (const root of tempRoots) {
      try {
        rmSync(root, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
    tempRoots.length = 0;
  });

  it('should rollback all changes when full rebuild fails mid-run', async () => {
    // Arrange
    const projectRoot = join('/tmp', `bunner-index-full-tx-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    tempRoots.push(projectRoot);

    mkdirSync(join(projectRoot, '.bunner', 'cards'), { recursive: true });
    mkdirSync(join(projectRoot, '.bunner', 'cache'), { recursive: true });
    mkdirSync(join(projectRoot, 'src'), { recursive: true });

    // A card that will fail indexing because it references an unregistered keyword.
    await Bun.write(
      join(projectRoot, '.bunner', 'cards', 'bad.card.md'),
      [
        '---',
        'key: bad',
        'summary: bad',
        'status: draft',
        'keywords:',
        '  - foo',
        '---',
        '',
        'body',
        '',
      ].join('\n'),
    );

    // Minimal code file to satisfy scanner.
    await Bun.write(join(projectRoot, 'src', 'main.ts'), 'export const x = 1;\n');

    const db = createDb(':memory:');

    // Seed a row that must survive if full rebuild is atomic.
    db.insert(card)
      .values({
        key: 'pre/existing',
        summary: 'seed',
        status: 'draft',
        constraintsJson: null,
        body: null,
        filePath: '.bunner/cards/pre-existing.card.md',
        updatedAt: new Date().toISOString(),
      })
      .run();

    const config = {
      sourceDir: './src',
      entry: './src/main.ts',
      module: { fileName: 'module.ts' },
      mcp: {
        exclude: [],
        card: { relations: ['depends-on', 'references', 'related', 'extends', 'conflicts'] },
      },
    } as const;

    // Act
    let thrown: unknown = null;
    try {
      await indexProject({ projectRoot, config: config as any, db: db as any, mode: 'full' });
    } catch (err) {
      thrown = err;
    }

    // Assert
    expect(thrown).not.toBeNull();

    const stillThere = db.select({ key: card.key }).from(card).where(eq(card.key, 'pre/existing')).all();
    expect(stillThere.length).toBe(1);

    closeDb(db);
  });
});
import { afterEach, describe, expect, it } from 'bun:test';

import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

import type { ResolvedBunnerConfig } from '../../config';

import { createDb, closeDb } from '../../store/connection';
import { indexProject } from './index-project';

function tmpDir(name: string): string {
  return join('/tmp', `bunner-${name}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
}

describe('indexProject (full transaction)', () => {
  const createdPaths: string[] = [];

  afterEach(async () => {
    for (const p of createdPaths) {
      // eslint-disable-next-line no-await-in-loop
      await rm(p, { recursive: true, force: true });
    }
    createdPaths.length = 0;
  });

  it('should wrap full rebuild in a single top-level transaction', async () => {
    // Arrange
    const projectRoot = tmpDir('index-full-tx');
    createdPaths.push(projectRoot);

    await mkdir(join(projectRoot, '.bunner', 'cards'), { recursive: true });
    await mkdir(join(projectRoot, 'src'), { recursive: true });

    await Bun.write(
      join(projectRoot, '.bunner', 'cards', 'a.card.md'),
      `---\nkey: a\nsummary: A\nstatus: draft\n---\nbody\n`,
    );

    await Bun.write(join(projectRoot, 'src', 'a.ts'), `/** @see a */\nexport const x = 1;\n`);

    const config: ResolvedBunnerConfig = {
      sourceDir: './src',
      entry: './src/a.ts',
      module: { fileName: 'module.ts' },
      mcp: { exclude: [], card: { relations: ['depends-on', 'references', 'related', 'extends', 'conflicts'] } },
    };

    const dbPath = join(projectRoot, '.bunner', 'cache', 'index.sqlite');
    await mkdir(join(projectRoot, '.bunner', 'cache'), { recursive: true });

    const db = createDb(dbPath);

    const seen: string[] = [];
    const originalRun = db.run.bind(db);
    (db as any).run = (q: any) => {
      const text =
        typeof q === 'string'
          ? q
          : q && typeof q.toQuery === 'function'
            ? (q.toQuery({}) as { sql: string }).sql
            : String(q);
      if (
        text.includes('BEGIN') ||
        text.includes('COMMIT') ||
        text.includes('SAVEPOINT') ||
        text.includes('RELEASE SAVEPOINT')
      ) {
        seen.push(text);
      }
      return originalRun(q);
    };

    // Act
    try {
      await indexProject({ projectRoot, config, db: db as any, mode: 'full' });
    } finally {
      closeDb(db);
    }

    // Assert
    const beginCount = seen.filter((s) => s.includes('BEGIN')).length;
    const commitCount = seen.filter((s) => s.includes('COMMIT')).length;

    expect(beginCount).toBe(1);
    expect(commitCount).toBe(1);
  });
});
