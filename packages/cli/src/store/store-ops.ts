import { drizzle } from 'drizzle-orm/bun-sqlite';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import { eq, notLike } from 'drizzle-orm';
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { mkdirSync, rmSync } from 'node:fs';
import { dirname } from 'node:path';
import { Database } from 'bun:sqlite';

import * as schema from './schema';

const sqliteMaster = sqliteTable('sqlite_master', {
  name: text('name'),
});

export function openDb(path: string) {
  if (path !== ':memory:') {
    mkdirSync(dirname(path), { recursive: true });
  }
  const client = new Database(path);
  return drizzle(client, { schema, casing: 'snake_case' });
}

export function runMigrations(db: any, migrationsFolder: string) {
  migrate(db, { migrationsFolder });
}

export function deleteSqliteFilesSync(path: string) {
  const candidates = [path, `${path}-wal`, `${path}-shm`];
  for (const filePath of candidates) {
    rmSync(filePath, { force: true });
  }
}

export function readExistingSchemaVersion(db: any): number | null {
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
    return null;
  }
}

export function hasAnyUserObjects(db: any): boolean {
  const row = db
    .select({ name: sqliteMaster.name })
    .from(sqliteMaster)
    .where(notLike(sqliteMaster.name, 'sqlite_%'))
    .limit(1)
    .get() as { name?: string } | undefined;

  return typeof row?.name === 'string';
}

export function ensureSchemaVersion(db: any, schemaVersion: number) {
  const rows = db
    .select()
    .from(schema.metadata)
    .where(eq(schema.metadata.key, 'schema_version'))
    .all();

  if (rows.length === 0) {
    db.insert(schema.metadata)
      .values({ key: 'schema_version', value: String(schemaVersion) })
      .run();
  }
}
