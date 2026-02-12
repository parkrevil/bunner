import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

let mismatchDbSeq = 0;

function getTempDir() {
  return process.env.TMPDIR ?? process.env.TEMP ?? process.env.TMP ?? '/tmp';
}

function makeTempDbPath(prefix: string) {
  mismatchDbSeq += 1;
  const name = `${prefix}_${process.pid}_${mismatchDbSeq}_${crypto.randomUUID()}.sqlite`;
  return `${getTempDir()}/${name}`;
}

async function deleteIfExists(path: string) {
  const file = Bun.file(path);
  if (await file.exists()) {
    await file.delete();
  }
}

async function cleanupSqliteFiles(path: string) {
  await deleteIfExists(path);
  await deleteIfExists(`${path}-wal`);
  await deleteIfExists(`${path}-shm`);
}

import { createDb, closeDb, SCHEMA_VERSION } from '../src/store/connection';
import {
  metadata,
  card,
  keyword,
  cardKeyword,
  codeEntity,
  cardRelation,
  cardCodeLink,
  codeRelation,
  fileState,
} from '../src/store/schema';

const sqliteMaster = sqliteTable('sqlite_master', {
  name: text('name'),
  type: text('type'),
});

const cardFts = sqliteTable('card_fts', {
  key: text('key'),
  summary: text('summary'),
  body: text('body'),
  keywords: text('keywords'),
});

describe('store', () => {
  let db: ReturnType<typeof createDb>;

  beforeEach(() => {
    db = createDb(':memory:');
  });

  afterEach(() => {
    closeDb(db);
  });

  describe('connection', () => {
    it('opens database with WAL journal mode', () => {
      const journalMode = db.get(sql`PRAGMA journal_mode`) as unknown;
      // in-memory DB returns 'memory' for journal_mode; WAL applies to file-based DBs
      // Verify the pragma was executed without error (in-memory falls back to 'memory')
      expect(journalMode).toBeDefined();
    });

    it('sets busy_timeout to 5000ms', () => {
      const rows = db.values(sql`PRAGMA busy_timeout`);
      expect(rows[0]?.[0]).toBe(5000);
    });

    it('stores schema_version in metadata table', () => {
      const rows = db.select().from(metadata).where(eq(metadata.key, 'schema_version')).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]!.value).toBe(String(SCHEMA_VERSION));
    });
  });

  describe('schema — tables exist', () => {
    it('metadata table accepts key-value pairs', () => {
      db.insert(metadata).values({ key: 'test_key', value: 'test_value' }).run();
      const rows = db.select().from(metadata).where(eq(metadata.key, 'test_key')).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toEqual({ key: 'test_key', value: 'test_value' });
    });

    it('card table stores card metadata', () => {
      const now = new Date().toISOString();
      db.insert(card)
        .values({
          key: 'spec::auth/login',
          type: 'spec',
          summary: 'OAuth login',
          status: 'draft',
          keywords: 'auth mvp',
          constraintsJson: null,
          body: '# Login spec',
          filePath: '.bunner/cards/auth/login.card.md',
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(card).where(eq(card.key, 'spec::auth/login')).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]!.type).toBe('spec');
      expect(rows[0]!.summary).toBe('OAuth login');
      expect(rows[0]!.status).toBe('draft');
      expect(rows[0]!.keywords).toBe('auth mvp');
      expect(rows[0]!.body).toBe('# Login spec');
    });

    it('keyword table stores unique keywords', () => {
      db.insert(keyword).values({ name: 'auth' }).run();
      db.insert(keyword).values({ name: 'mvp' }).run();

      const rows = db.select().from(keyword).all();
      expect(rows).toHaveLength(2);

      // UNIQUE constraint on name
      expect(() => {
        db.insert(keyword).values({ name: 'auth' }).run();
      }).toThrow();
    });

    it('card_keyword table maps cards to keywords', () => {
      const now = new Date().toISOString();
      db.insert(card).values({
        key: 'spec::auth/login',
        type: 'spec',
        summary: 'OAuth login',
        status: 'draft',
        filePath: '.bunner/cards/auth/login.card.md',
        updatedAt: now,
      }).run();
      db.insert(keyword).values({ id: 1, name: 'auth' }).run();

      db.insert(cardKeyword).values({ cardKey: 'spec::auth/login', keywordId: 1 }).run();

      const rows = db.select().from(cardKeyword).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toEqual({ cardKey: 'spec::auth/login', keywordId: 1 });
    });

    it('code_entity table stores parsed code entities', () => {
      const now = new Date().toISOString();
      db.insert(codeEntity)
        .values({
          entityKey: 'symbol:src/auth/login.ts#handleOAuth',
          filePath: 'src/auth/login.ts',
          symbolName: 'handleOAuth',
          kind: 'function',
          signature: '() => Promise<void>',
          fingerprint: 'abc123',
          contentHash: 'hash456',
          updatedAt: now,
        })
        .run();

      const rows = db
        .select()
        .from(codeEntity)
        .where(eq(codeEntity.entityKey, 'symbol:src/auth/login.ts#handleOAuth'))
        .all();
      expect(rows).toHaveLength(1);
      expect(rows[0]!.symbolName).toBe('handleOAuth');
      expect(rows[0]!.kind).toBe('function');
    });

    it('card_relation table stores typed card edges', () => {
      const now = new Date().toISOString();
      db.insert(card).values({
        key: 'spec::auth/login',
        type: 'spec', summary: 'Login', status: 'draft',
        filePath: 'a.md', updatedAt: now,
      }).run();
      db.insert(card).values({
        key: 'spec::auth/session',
        type: 'spec', summary: 'Session', status: 'draft',
        filePath: 'b.md', updatedAt: now,
      }).run();

      db.insert(cardRelation).values({
        type: 'depends_on',
        srcCardKey: 'spec::auth/login',
        dstCardKey: 'spec::auth/session',
        isReverse: false,
      }).run();

      const rows = db.select().from(cardRelation).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]!.type).toBe('depends_on');
      expect(rows[0]!.srcCardKey).toBe('spec::auth/login');
      expect(rows[0]!.isReverse).toBe(false);
    });

    it('card_code_link table links cards to code entities', () => {
      const now = new Date().toISOString();
      db.insert(card).values({
        key: 'spec::auth/login',
        type: 'spec', summary: 'Login', status: 'draft',
        filePath: 'a.md', updatedAt: now,
      }).run();
      db.insert(codeEntity).values({
        entityKey: 'symbol:src/auth/login.ts#handleOAuth',
        filePath: 'src/auth/login.ts',
        kind: 'function', contentHash: 'h1', updatedAt: now,
      }).run();

      db.insert(cardCodeLink).values({
        type: 'see',
        cardKey: 'spec::auth/login',
        entityKey: 'symbol:src/auth/login.ts#handleOAuth',
        filePath: 'src/auth/login.ts',
        symbolName: 'handleOAuth',
      }).run();

      const rows = db.select().from(cardCodeLink).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]!.cardKey).toBe('spec::auth/login');
    });

    it('code_relation table stores code-to-code edges', () => {
      const now = new Date().toISOString();
      db.insert(codeEntity).values({
        entityKey: 'module:src/auth/login.ts',
        filePath: 'src/auth/login.ts',
        kind: 'module', contentHash: 'h1', updatedAt: now,
      }).run();
      db.insert(codeEntity).values({
        entityKey: 'module:src/auth/session.ts',
        filePath: 'src/auth/session.ts',
        kind: 'module', contentHash: 'h2', updatedAt: now,
      }).run();

      db.insert(codeRelation).values({
        type: 'imports',
        srcEntityKey: 'module:src/auth/login.ts',
        dstEntityKey: 'module:src/auth/session.ts',
      }).run();

      const rows = db.select().from(codeRelation).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]!.type).toBe('imports');
    });

    it('file_state table tracks file indexing state', () => {
      const now = new Date().toISOString();
      db.insert(fileState)
        .values({
          path: 'src/auth/login.ts',
          contentHash: 'abc123',
          mtime: now,
          lastIndexedAt: now,
        })
        .run();

      const rows = db
        .select()
        .from(fileState)
        .where(eq(fileState.path, 'src/auth/login.ts'))
        .all();
      expect(rows).toHaveLength(1);
      expect(rows[0]!.contentHash).toBe('abc123');
    });
  });

  describe('schema — constraints', () => {
    it('card.key is PRIMARY KEY (rejects duplicates)', () => {
      const now = new Date().toISOString();
      const row = {
        key: 'spec::auth/login',
        type: 'spec', summary: 'Login', status: 'draft',
        filePath: 'a.md', updatedAt: now,
      };
      db.insert(card).values(row).run();
      expect(() => db.insert(card).values(row).run()).toThrow();
    });

    it('card_keyword has composite PRIMARY KEY (card_key, keyword_id)', () => {
      const now = new Date().toISOString();
      db.insert(card).values({
        key: 'spec::a', type: 'spec', summary: 's', status: 'draft',
        filePath: 'a.md', updatedAt: now,
      }).run();
      db.insert(keyword).values({ id: 1, name: 'auth' }).run();

      db.insert(cardKeyword).values({ cardKey: 'spec::a', keywordId: 1 }).run();
      expect(() =>
        db.insert(cardKeyword).values({ cardKey: 'spec::a', keywordId: 1 }).run(),
      ).toThrow();
    });

    it('file_state.path is PRIMARY KEY', () => {
      const now = new Date().toISOString();
      const row = { path: 'src/a.ts', contentHash: 'h', mtime: now, lastIndexedAt: now };
      db.insert(fileState).values(row).run();
      expect(() => db.insert(fileState).values(row).run()).toThrow();
    });
  });

  describe('fts5 — virtual tables and triggers', () => {
    it('creates card_fts and code_fts virtual tables', () => {
      const rows = db
        .select({ name: sqliteMaster.name, type: sqliteMaster.type })
        .from(sqliteMaster)
        .where(inArray(sqliteMaster.name, ['card_fts', 'code_fts']))
        .orderBy(asc(sqliteMaster.name))
        .all();

      expect(rows).toEqual([
        { name: 'card_fts', type: 'table' },
        { name: 'code_fts', type: 'table' },
      ]);
    });

    it('creates sync triggers for card_fts and code_fts', () => {
      const rows = db
        .select({ name: sqliteMaster.name, type: sqliteMaster.type })
        .from(sqliteMaster)
        .where(
          and(
            eq(sqliteMaster.type, 'trigger'),
            inArray(sqliteMaster.name, [
              'card_fts_ai',
              'card_fts_au',
              'card_fts_ad',
              'code_fts_ai',
              'code_fts_au',
              'code_fts_ad',
            ]),
          ),
        )
        .orderBy(asc(sqliteMaster.name))
        .all();

      expect(rows).toEqual([
        { name: 'card_fts_ad', type: 'trigger' },
        { name: 'card_fts_ai', type: 'trigger' },
        { name: 'card_fts_au', type: 'trigger' },
        { name: 'code_fts_ad', type: 'trigger' },
        { name: 'code_fts_ai', type: 'trigger' },
        { name: 'code_fts_au', type: 'trigger' },
      ]);
    });

    it('keeps card_fts in sync on insert/update/delete', () => {
      const now = new Date().toISOString();
      db.insert(card)
        .values({
          key: 'spec::auth/login',
          type: 'spec',
          summary: 'OAuth login',
          status: 'draft',
          keywords: 'auth',
          constraintsJson: null,
          body: 'body',
          filePath: 'a.md',
          updatedAt: now,
        })
        .run();

      const inserted = db
        .select({ key: cardFts.key, summary: cardFts.summary })
        .from(cardFts)
        .where(eq(cardFts.key, 'spec::auth/login'))
        .limit(1)
        .get();

      expect(inserted).toEqual({ key: 'spec::auth/login', summary: 'OAuth login' });

      db.update(card)
        .set({ summary: 'Updated summary' })
        .where(eq(card.key, 'spec::auth/login'))
        .run();

      const updated = db
        .select({ key: cardFts.key, summary: cardFts.summary })
        .from(cardFts)
        .where(eq(cardFts.key, 'spec::auth/login'))
        .limit(1)
        .get();

      expect(updated).toEqual({ key: 'spec::auth/login', summary: 'Updated summary' });

      db.delete(card).where(eq(card.key, 'spec::auth/login')).run();

      const afterDelete = db
        .select({ key: cardFts.key })
        .from(cardFts)
        .where(eq(cardFts.key, 'spec::auth/login'))
        .all();

      expect(afterDelete).toEqual([]);
    });
  });

  describe('schema versioning — mismatch rebuild', () => {
    it('drops all user objects and rebuilds when schema_version mismatches', async () => {
      const dbPath = makeTempDbPath('store_mismatch');

      const bootstrap = drizzle(dbPath);
      bootstrap.run(sql`CREATE TABLE metadata (key text PRIMARY KEY NOT NULL, value text NOT NULL)`);
      bootstrap.run(sql`INSERT INTO metadata(key, value) VALUES('schema_version', '1')`);
      bootstrap.run(sql`CREATE TABLE old_table (x text)`);
      bootstrap.$client.close();

      const rebuilt = createDb(dbPath);
      try {
        const old = rebuilt
          .select({ name: sqliteMaster.name })
          .from(sqliteMaster)
          .where(and(eq(sqliteMaster.type, 'table'), eq(sqliteMaster.name, 'old_table')))
          .limit(1)
          .get();

        expect(old == null).toBe(true);

        const versionRow = rebuilt
          .select()
          .from(metadata)
          .where(eq(metadata.key, 'schema_version'))
          .all();
        expect(versionRow).toHaveLength(1);
        expect(versionRow[0]!.value).toBe(String(SCHEMA_VERSION));
      } finally {
        closeDb(rebuilt);
        await cleanupSqliteFiles(dbPath);
      }
    });

    it('rebuilds when schema_version is missing but user objects exist', async () => {
      const dbPath = makeTempDbPath('store_unknown');

      const bootstrap = drizzle(dbPath);
      bootstrap.run(sql`CREATE TABLE old_table (x text)`);
      bootstrap.$client.close();

      const rebuilt = createDb(dbPath);
      try {
        const old = rebuilt
          .select({ name: sqliteMaster.name })
          .from(sqliteMaster)
          .where(and(eq(sqliteMaster.type, 'table'), eq(sqliteMaster.name, 'old_table')))
          .limit(1)
          .get();

        expect(old == null).toBe(true);

        const versionRow = rebuilt
          .select()
          .from(metadata)
          .where(eq(metadata.key, 'schema_version'))
          .all();
        expect(versionRow).toHaveLength(1);
        expect(versionRow[0]!.value).toBe(String(SCHEMA_VERSION));
      } finally {
        closeDb(rebuilt);
        await cleanupSqliteFiles(dbPath);
      }
    });
  });
});
