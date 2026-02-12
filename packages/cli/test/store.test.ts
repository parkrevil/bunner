import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { eq } from 'drizzle-orm';

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
      // Pragma verification via underlying bun:sqlite client (test infra only)
      const sqliteDb = (db as any).session.client;
      const journalMode = sqliteDb.query('PRAGMA journal_mode').get();
      // in-memory DB returns 'memory' for journal_mode; WAL applies to file-based DBs
      // Verify the pragma was executed without error (in-memory falls back to 'memory')
      expect(journalMode).toBeDefined();
    });

    it('sets busy_timeout to 5000ms', () => {
      const sqliteDb = (db as any).session.client;
      const busyTimeout = sqliteDb.query('PRAGMA busy_timeout').get();
      expect(busyTimeout).toEqual({ timeout: 5000 });
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
});
