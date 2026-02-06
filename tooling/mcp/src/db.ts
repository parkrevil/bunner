import { drizzle } from 'drizzle-orm/bun-sql';
import type { SQL as DrizzleSql } from 'drizzle-orm';
import { SQL as BunSql } from 'bun';

export type Db = {
  execute: (statement: DrizzleSql) => Promise<{ rows: unknown[] }>;
};

// MUST: MUST-1

export async function createDb(databaseUrl: string): Promise<Db> {
  const client = new BunSql(databaseUrl);
  const db = drizzle({ client });

  return {
    execute: async (statement) => {
      const result = await db.execute(statement);
      const maybeRows = (result as { rows?: unknown[] } | null | undefined)?.rows;
      if (Array.isArray(maybeRows)) return { rows: maybeRows };
      if (Array.isArray(result)) return { rows: result as unknown[] };
      return { rows: [] };
    },
  };
}
