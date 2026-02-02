import type { FileIndexEntry, FileIndexRepository } from '../../ports/file-index.repository';

const keyOf = (input: { projectKey: string; filePath: string }): string => `${input.projectKey}|${input.filePath}`;

const createInMemoryFileIndexRepository = (): FileIndexRepository => {
  const store = new Map<string, FileIndexEntry>();

  return {
    async getFile({ projectKey, filePath }): Promise<FileIndexEntry | null> {
      return store.get(keyOf({ projectKey, filePath })) ?? null;
    },

    async upsertFile({ projectKey, filePath, mtimeMs, size, contentHash }): Promise<void> {
      store.set(keyOf({ projectKey, filePath }), {
        filePath,
        mtimeMs,
        size,
        contentHash,
        updatedAt: Date.now(),
      });
    },

    async deleteFile({ projectKey, filePath }): Promise<void> {
      store.delete(keyOf({ projectKey, filePath }));
    },
  };
};

export { createInMemoryFileIndexRepository };
