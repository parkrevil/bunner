import { mkdir } from 'node:fs/promises';
import * as path from 'node:path';

import { Database } from 'bun:sqlite';

import { drizzle } from 'drizzle-orm/bun-sqlite';
import { and, eq } from 'drizzle-orm';

import { reports } from './schema';

import type { CacheRepository } from '../../ports/cache.repository';
import type { FirebatReport } from '../../types';

const CACHE_RELATIVE_PATH = '.firebat/firebat.sqlite';

const ensureDatabase = async (dbFilePath: string): Promise<Database> => {
  const dirPath = path.dirname(dbFilePath);

  await mkdir(dirPath, { recursive: true });

  const db = new Database(dbFilePath);

  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;

    CREATE TABLE IF NOT EXISTS reports (
      projectKey TEXT NOT NULL,
      reportKey TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      reportJson TEXT NOT NULL,
      PRIMARY KEY (projectKey, reportKey)
    );
  `);

  return db;
};

let dbPromise: Promise<Database> | null = null;

const getDb = (): Promise<Database> => {
  dbPromise ??= ensureDatabase(path.resolve(process.cwd(), CACHE_RELATIVE_PATH));
  return dbPromise;
};

const createSqliteCacheRepository = (): CacheRepository => {
  return {
    async getReport({ projectKey, reportKey }): Promise<FirebatReport | null> {
      const sqlite = await getDb();
      const db = drizzle({ client: sqlite });

      const row = db
        .select({ reportJson: reports.reportJson })
        .from(reports)
        .where(and(eq(reports.projectKey, projectKey), eq(reports.reportKey, reportKey)))
        .get();

      if (!row) {
        return null;
      }

      try {
        return JSON.parse(row.reportJson) as FirebatReport;
      } catch {
        return null;
      }
    },

    async setReport({ projectKey, reportKey, report }): Promise<void> {
      const sqlite = await getDb();
      const db = drizzle({ client: sqlite });

      const createdAt = Date.now();
      const reportJson = JSON.stringify(report);

      db.insert(reports)
        .values({ projectKey, reportKey, createdAt, reportJson })
        .onConflictDoUpdate({
          target: [reports.projectKey, reports.reportKey],
          set: { createdAt, reportJson },
        })
        .run();
    },
  };
};

export { createSqliteCacheRepository };
