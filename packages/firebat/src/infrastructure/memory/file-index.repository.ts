import type {
  DeleteFileInput,
  FileIndexEntry,
  FileIndexRepository,
  GetFileInput,
  UpsertFileInput,
} from '../../ports/file-index.repository';

const keyOf = (input: GetFileInput): string => `${input.projectKey}|${input.filePath}`;

const createInMemoryFileIndexRepository = (): FileIndexRepository => {
  const store = new Map<string, FileIndexEntry>();

  return {
    async getFile({ projectKey, filePath }: GetFileInput): Promise<FileIndexEntry | null> {
      return Promise.resolve(store.get(keyOf({ projectKey, filePath })) ?? null);
    },

    async upsertFile({ projectKey, filePath, mtimeMs, size, contentHash }: UpsertFileInput): Promise<void> {
      store.set(keyOf({ projectKey, filePath }), {
        filePath,
        mtimeMs,
        size,
        contentHash,
        updatedAt: Date.now(),
      });

      return Promise.resolve();
    },

    async deleteFile({ projectKey, filePath }: DeleteFileInput): Promise<void> {
      store.delete(keyOf({ projectKey, filePath }));

      return Promise.resolve();
    },
  };
};

export { createInMemoryFileIndexRepository };
