import { and, eq } from 'drizzle-orm';

import { reports } from './schema';
import { getOrmDb } from './firebat.db';

import type { CacheRepository } from '../../ports/cache.repository';
import type { FirebatReport } from '../../types';

const createSqliteCacheRepository = (): CacheRepository => {
  return {
    async getReport({ projectKey, reportKey }): Promise<FirebatReport | null> {
      const db = await getOrmDb();
      const row = db
        .select({ reportJson: reports.reportJson })
        .from(reports)
        .where(and(eq(reports.projectKey, projectKey), eq(reports.reportKey, reportKey)))
        .get();

      if (!row) {
        return null;
      }

      try {
        // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion
        const parsed = JSON.parse(row.reportJson) as FirebatReport;

        return parsed;
      } catch {
        return null;
      }
    },

    async setReport({ projectKey, reportKey, report }): Promise<void> {
      const db = await getOrmDb();
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
