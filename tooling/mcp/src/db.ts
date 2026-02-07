import { drizzle } from 'drizzle-orm/bun-sql';
import type { SQL as DrizzleSql } from 'drizzle-orm';
import { SQL as BunSql } from 'bun';

import * as schema from '../drizzle/schema';

export type Db = {
  db: ReturnType<typeof drizzle>;
  execute: (statement: DrizzleSql) => Promise<{ rows: unknown[] }>;
  close: (options?: { timeout?: number }) => Promise<void>;
};

// MUST: MUST-1

export async function createDb(databaseUrl: string): Promise<Db> {
  const client = new BunSql(databaseUrl);
  const db = drizzle({ client, schema });

  const normalizeValue = (value: unknown): unknown => {
    if (typeof value === 'bigint') {
      const max = BigInt(Number.MAX_SAFE_INTEGER);
      const min = BigInt(Number.MIN_SAFE_INTEGER);
      if (value <= max && value >= min) return Number(value);
      return value.toString();
    }

    if (Array.isArray(value)) return value.map(normalizeValue);

    if (value && typeof value === 'object') {
      const obj = value as Record<string, unknown>;
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(obj)) out[k] = normalizeValue(v);
      return out;
    }

    return value;
  };

  return {
    db,
    execute: async (statement) => {
      const result = await db.execute(statement);
      const maybeRows = (result as { rows?: unknown[] } | null | undefined)?.rows;
      const rows = Array.isArray(maybeRows)
        ? maybeRows
        : Array.isArray(result)
          ? (result as unknown[])
          : [];

      return { rows: rows.map(normalizeValue) };
    },
    close: async (options) => {
      const maybeClose = (client as unknown as { close?: (opts?: { timeout?: number }) => Promise<void> }).close;
      if (typeof maybeClose === 'function') {
        await maybeClose(options);
      }
    },
  };
}
