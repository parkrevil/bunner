import type { MemoryKeyEntry, MemoryRecord, MemoryRepository } from '../../ports/memory.repository';

import { and, desc, eq } from 'drizzle-orm';

import type { FirebatDrizzleDb } from './drizzle-db';
import { memories } from './schema';

const createSqliteMemoryRepository = (db: FirebatDrizzleDb): MemoryRepository => {
  return {
     async listKeys({ projectKey }): Promise<ReadonlyArray<MemoryKeyEntry>> {
      const rows = db
        .select({ memoryKey: memories.memoryKey, updatedAt: memories.updatedAt })
        .from(memories)
        .where(eq(memories.projectKey, projectKey))
        .orderBy(desc(memories.updatedAt))
        .all();

      return Promise.resolve(rows);
    },

     async read({ projectKey, memoryKey }): Promise<MemoryRecord | null> {
      const row = db
        .select({
          projectKey: memories.projectKey,
          memoryKey: memories.memoryKey,
          createdAt: memories.createdAt,
          updatedAt: memories.updatedAt,
          payloadJson: memories.payloadJson,
        })
        .from(memories)
        .where(and(eq(memories.projectKey, projectKey), eq(memories.memoryKey, memoryKey)))
        .get();

      return Promise.resolve(row ?? null);
    },

     async write({ projectKey, memoryKey, payloadJson }): Promise<void> {
      const now = Date.now();
      const existing = db
        .select({ createdAt: memories.createdAt })
        .from(memories)
        .where(and(eq(memories.projectKey, projectKey), eq(memories.memoryKey, memoryKey)))
        .get();
      const createdAt = existing?.createdAt ?? now;

      db.insert(memories)
        .values({ projectKey, memoryKey, createdAt, updatedAt: now, payloadJson })
        .onConflictDoUpdate({
          target: [memories.projectKey, memories.memoryKey],
          set: { updatedAt: now, payloadJson },
        })
        .run();

      return Promise.resolve();
    },

     async delete({ projectKey, memoryKey }): Promise<void> {
      db.delete(memories).where(and(eq(memories.projectKey, projectKey), eq(memories.memoryKey, memoryKey))).run();

      return Promise.resolve();
    },
  };
};

export { createSqliteMemoryRepository };
