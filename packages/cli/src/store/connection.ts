import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import { eq } from 'drizzle-orm';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

import * as schema from './schema';

/**
 * Current schema version. Compared against metadata.schema_version on open.
 * Mismatch → DROP ALL + rebuild (disposable DB).
 */
export const SCHEMA_VERSION = 1;

export type StoreDb = ReturnType<typeof createDb>;

/**
 * Create and initialize a drizzle database instance.
 *
 * - Opens bun:sqlite with WAL journal mode
 * - Sets busy_timeout = 5000
 * - Creates all tables if not present (push schema)
 * - Seeds schema_version in metadata if missing
 */
export function createDb(path: string) {
  const sqlite = new Database(path);

  // Pragmas: WAL mode + busy timeout
  sqlite.exec('PRAGMA journal_mode = WAL');
  sqlite.exec('PRAGMA busy_timeout = 5000');

  const db = drizzle(sqlite, { schema });

  const migrationsFolder = resolve(dirname(fileURLToPath(import.meta.url)), '../../drizzle');
  migrate(db, { migrationsFolder });

  // Seed schema_version if not present
  const existing = db
    .select()
    .from(schema.metadata)
    .where(eq(schema.metadata.key, 'schema_version'))
    .all();

  if (existing.length === 0) {
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
  const sqlite = (db as any).session.client as Database;
  sqlite.close();
}
