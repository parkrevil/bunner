// MUST: MUST-1
import type {
  DeleteFileInput,
  FileIndexEntry,
  FileIndexRepository,
  GetFileInput,
  UpsertFileInput,
} from '../../ports/file-index.repository';

interface HybridFileIndexDeps {
  readonly memory: FileIndexRepository;
  readonly sqlite: FileIndexRepository;
}

const createHybridFileIndexRepository = (input: HybridFileIndexDeps): FileIndexRepository => {
  const { memory, sqlite } = input;

  return {
    async getFile(args: GetFileInput): Promise<FileIndexEntry | null> {
      const fromMemory = await memory.getFile(args);

      if (fromMemory) {
        return fromMemory;
      }

      const fromSqlite = await sqlite.getFile(args);

      if (fromSqlite) {
        await memory.upsertFile({
          projectKey: args.projectKey,
          filePath: args.filePath,
          mtimeMs: fromSqlite.mtimeMs,
          size: fromSqlite.size,
          contentHash: fromSqlite.contentHash,
        });
      }

      return fromSqlite;
    },

    async upsertFile(args: UpsertFileInput): Promise<void> {
      await memory.upsertFile(args);
      await sqlite.upsertFile(args);
    },

    async deleteFile(args: DeleteFileInput): Promise<void> {
      await memory.deleteFile(args);
      await sqlite.deleteFile(args);
    },
  };
};

export { createHybridFileIndexRepository };
