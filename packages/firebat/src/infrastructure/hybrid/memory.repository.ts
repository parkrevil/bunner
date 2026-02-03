// MUST: MUST-1
import type {
  DeleteMemoryInput,
  ListMemoryKeysInput,
  MemoryKeyEntry,
  MemoryRecord,
  MemoryRepository,
  ReadMemoryInput,
  WriteMemoryInput,
} from '../../ports/memory.repository';

interface HybridMemoryDeps {
  readonly memory: MemoryRepository;
  readonly sqlite: MemoryRepository;
}

const createHybridMemoryRepository = (input: HybridMemoryDeps): MemoryRepository => {
  const { memory, sqlite } = input;

  return {
    async listKeys(args: ListMemoryKeysInput): Promise<ReadonlyArray<MemoryKeyEntry>> {
      // Keep list as authoritative from sqlite (persistence).
      return sqlite.listKeys(args);
    },

    async read(args: ReadMemoryInput): Promise<MemoryRecord | null> {
      const fromMemory = await memory.read(args);

      if (fromMemory) {
        return fromMemory;
      }

      const fromSqlite = await sqlite.read(args);

      if (fromSqlite) {
        await memory.write({ projectKey: args.projectKey, memoryKey: args.memoryKey, payloadJson: fromSqlite.payloadJson });
      }

      return fromSqlite;
    },

    async write(args: WriteMemoryInput): Promise<void> {
      await memory.write(args);
      await sqlite.write(args);
    },

    async delete(args: DeleteMemoryInput): Promise<void> {
      await memory.delete(args);
      await sqlite.delete(args);
    },
  };
};

export { createHybridMemoryRepository };
