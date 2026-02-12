import { drizzle } from 'drizzle-orm/bun-sqlite';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import { eq, notLike, sql } from 'drizzle-orm';
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { rmSync } from 'node:fs';

import * as schema from './schema';

/**
 * Current schema version. Compared against metadata.schema_version on open.
 * Mismatch → DROP ALL + rebuild (disposable DB).
 */
export const SCHEMA_VERSION = 2;

export type StoreDb = ReturnType<typeof createDb>;

const sqliteMaster = sqliteTable('sqlite_master', {
  name: text('name'),
});

function configureConnection(db: any) {
  db.run(sql`PRAGMA journal_mode = WAL`);
  db.run(sql`PRAGMA busy_timeout = 5000`);
}

function readExistingSchemaVersion(db: any): number | null {
  try {
    const row = db
      .select({ value: schema.metadata.value })
      .from(schema.metadata)
      .where(eq(schema.metadata.key, 'schema_version'))
      .get() as { value?: string } | undefined;

    if (!row || typeof row.value !== 'string') {
      return null;
    }

    const parsed = Number(row.value);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    // metadata table doesn't exist yet or DB is in an incompatible state
    return null;
  }
}

function hasAnyUserObjects(db: any): boolean {
  const row = db
    .select({ name: sqliteMaster.name })
    .from(sqliteMaster)
    .where(notLike(sqliteMaster.name, 'sqlite_%'))
    .limit(1)
    .get() as { name?: string } | undefined;

  return typeof row?.name === 'string';
}

function canDeleteDbFiles(path: string): boolean {
  return path !== ':memory:';
}

function deleteSqliteFilesSync(path: string) {
  // Bun's Bun.file(path).delete() is async; keep createDb() sync by using node:fs.
  // This DB is a disposable cache (PLAN-v5), so deleting files is the simplest rebuild.
  const candidates = [path, `${path}-wal`, `${path}-shm`];
  for (const filePath of candidates) {
    rmSync(filePath, { force: true });
  }
}

/**
 * Create the SQLite store connection.
 *
 * - Opens SQLite via Drizzle (bun-sqlite driver)
 * - Sets WAL journal mode + busy_timeout
 * - Runs migrations
 * - Ensures schema_version is set
 */
export function createDb(path: string) {
  const migrationsFolder = resolve(dirname(fileURLToPath(import.meta.url)), '../../drizzle');

  const open = () => {
    const db = path === ':memory:' ? drizzle({ schema }) : drizzle(path, { schema });
    configureConnection(db);
    return { db };
  };

  let { db } = open();

  const existingVersion = readExistingSchemaVersion(db);
  const shouldRebuildByVersion = existingVersion !== null && existingVersion !== SCHEMA_VERSION;
  const shouldRebuildByUnknown =
    existingVersion === null && canDeleteDbFiles(path) && hasAnyUserObjects(db);

  if ((shouldRebuildByVersion || shouldRebuildByUnknown) && canDeleteDbFiles(path)) {
    db.$client.close();
    deleteSqliteFilesSync(path);
    ({ db } = open());
  }

  try {
    migrate(db, { migrationsFolder });
  } catch (err) {
    // If the DB exists but is not compatible with our migrations (e.g. tables already exist),
    // treat it as disposable cache corruption and rebuild from scratch.
    if (!canDeleteDbFiles(path)) {
      throw err;
    }

    db.$client.close();
    deleteSqliteFilesSync(path);
    ({ db } = open());
    migrate(db, { migrationsFolder });
  }

  // Seed schema_version if not present
  const schemaVersionRows = db
    .select()
    .from(schema.metadata)
    .where(eq(schema.metadata.key, 'schema_version'))
    .all();

  if (schemaVersionRows.length === 0) {
    db.insert(schema.metadata)
      .values({ key: 'schema_version', value: String(SCHEMA_VERSION) })
      .run();
  }

  return db;
}

/**
 * Close the database connection.
 */
export function closeDb(db: StoreDb) {
  db.$client.close();
}
