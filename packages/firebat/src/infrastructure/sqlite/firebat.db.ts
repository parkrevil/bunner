import { mkdir } from 'node:fs/promises';
import * as path from 'node:path';

import { Database } from 'bun:sqlite';

import { createDrizzleDb, type FirebatDrizzleDb } from './drizzle-db';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';

const DB_RELATIVE_PATH = '.firebat/firebat.sqlite';

const resolveDbPath = (cwd: string): string => {
  const mode = (process.env.FIREBAT_DB_MODE ?? '').toLowerCase();

  if (mode === 'memory' || mode === 'in-memory') {
    return ':memory:';
  }

  const configuredPath = process.env.FIREBAT_DB_PATH;

  if (configuredPath && configuredPath.trim().length > 0) {
    const trimmed = configuredPath.trim();
    return path.isAbsolute(trimmed) ? trimmed : path.resolve(cwd, trimmed);
  }

  return path.resolve(cwd, DB_RELATIVE_PATH);
};

const ensureDatabase = async (dbFilePath: string): Promise<Database> => {
  if (dbFilePath !== ':memory:') {
    const dirPath = path.dirname(dbFilePath);
    await mkdir(dirPath, { recursive: true });
  }

  const db = new Database(dbFilePath);

  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
  `);

  return db;
};

let dbPromise: Promise<Database> | null = null;
let ormPromise: Promise<FirebatDrizzleDb> | null = null;

const getDb = (cwd: string = process.cwd()): Promise<Database> => {
  dbPromise ??= ensureDatabase(resolveDbPath(cwd));
  return dbPromise;
};

const getOrmDb = async (cwd: string = process.cwd()): Promise<FirebatDrizzleDb> => {
  ormPromise ??= getDb(cwd).then(sqlite => {
    const orm = createDrizzleDb(sqlite);

    const migrationsFolder = path.resolve(import.meta.dir, './migrations');

    migrate(orm, { migrationsFolder });

    return orm;
  });
  return ormPromise;
};

export { getDb, getOrmDb };
