// MUST: MUST-2
import { mkdir } from 'node:fs/promises';
import * as path from 'node:path';

import { Database } from 'bun:sqlite';

import { createDrizzleDb, type FirebatDrizzleDb } from './drizzle-db';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';

const DB_RELATIVE_PATH = '.firebat/firebat.sqlite';

const resolveDbPath = (cwd: string): string => {
  const configuredPath = process.env.FIREBAT_DB_PATH;

  if (configuredPath !== undefined && configuredPath.trim().length > 0) {
    const trimmed = configuredPath.trim();

    return path.isAbsolute(trimmed) ? trimmed : path.resolve(cwd, trimmed);
  }

  return path.resolve(cwd, DB_RELATIVE_PATH);
};

const ensureDatabase = async (dbFilePath: string): Promise<Database> => {
  const dirPath = path.dirname(dbFilePath);

  await mkdir(dirPath, { recursive: true });

  const db = new Database(dbFilePath);

  // oxlint-disable-next-line typescript-eslint/no-deprecated
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA busy_timeout = 5000;
    PRAGMA foreign_keys = ON;
  `);

  return db;
};

let dbPromise: Promise<Database> | null = null;
let ormPromise: Promise<FirebatDrizzleDb> | null = null;

const getDb =  async (cwd: string = process.cwd()): Promise<Database> => {
  dbPromise ??= ensureDatabase(resolveDbPath(cwd));

  return dbPromise;
};

const getOrmDb = async (cwd: string = process.cwd()): Promise<FirebatDrizzleDb> => {
  ormPromise ??= (async (): Promise<FirebatDrizzleDb> => {
      const sqlite = await getDb(cwd);
      const orm = createDrizzleDb(sqlite);
      const migrationsFolder = path.resolve(import.meta.dir, './migrations');

      migrate(orm, { migrationsFolder });

      return orm;
    })();

  return ormPromise;
};

export { getDb, getOrmDb };
