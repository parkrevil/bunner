import type {
  DeleteMemoryInput,
  ListMemoryKeysInput,
  MemoryKeyEntry,
  MemoryRecord,
  MemoryRepository,
  ReadMemoryInput,
  WriteMemoryInput,
} from '../../ports/memory.repository';

const createInMemoryMemoryRepository = (): MemoryRepository => {
  const store = new Map<string, MemoryRecord>();

  const keyOf = (projectKey: string, memoryKey: string): string => `${projectKey}::${memoryKey}`;

  return {
    async listKeys({ projectKey }: ListMemoryKeysInput): Promise<ReadonlyArray<MemoryKeyEntry>> {
      const rows: MemoryKeyEntry[] = [];

      for (const rec of store.values()) {
        if (rec.projectKey !== projectKey) {
          continue;
        }

        rows.push({ memoryKey: rec.memoryKey, updatedAt: rec.updatedAt });
      }

      rows.sort((a, b) => b.updatedAt - a.updatedAt);

      return Promise.resolve(rows);
    },

    async read({ projectKey, memoryKey }: ReadMemoryInput): Promise<MemoryRecord | null> {
      return Promise.resolve(store.get(keyOf(projectKey, memoryKey)) ?? null);
    },

    async write({ projectKey, memoryKey, payloadJson }: WriteMemoryInput): Promise<void> {
      const now = Date.now();
      const existing = store.get(keyOf(projectKey, memoryKey));
      const createdAt = existing?.createdAt ?? now;

      store.set(keyOf(projectKey, memoryKey), {
        projectKey,
        memoryKey,
        createdAt,
        updatedAt: now,
        payloadJson,
      });

      return Promise.resolve();
    },

    async delete({ projectKey, memoryKey }: DeleteMemoryInput): Promise<void> {
      store.delete(keyOf(projectKey, memoryKey));

      return Promise.resolve();
    },
  };
};

export { createInMemoryMemoryRepository };
