import type {
  ClearSymbolIndexProjectInput,
  GetIndexedFileInput,
  GetSymbolIndexStatsInput,
  ReplaceFileSymbolsInput,
  SearchSymbolsInput,
  SymbolIndexRepository,
  SymbolIndexStats,
  SymbolMatch,
} from '../../ports/symbol-index.repository';

interface HybridSymbolIndexDeps {
  readonly memory: SymbolIndexRepository;
  readonly sqlite: SymbolIndexRepository;
}

const createHybridSymbolIndexRepository = (input: HybridSymbolIndexDeps): SymbolIndexRepository => {
  return {
    async getIndexedFile(args: GetIndexedFileInput) {
      const mem = await input.memory.getIndexedFile(args);

      if (mem) {
        return mem;
      }

      return input.sqlite.getIndexedFile(args);
    },

    async replaceFileSymbols(args: ReplaceFileSymbolsInput) {
      await input.sqlite.replaceFileSymbols(args);
      await input.memory.replaceFileSymbols(args);
    },

    async search(args: SearchSymbolsInput): Promise<ReadonlyArray<SymbolMatch>> {
      const mem = await input.memory.search(args);

      if (mem.length > 0) {
        return mem;
      }

      return input.sqlite.search(args);
    },

    async getStats(args: GetSymbolIndexStatsInput): Promise<SymbolIndexStats> {
      const mem = await input.memory.getStats(args);

      if (mem.indexedFileCount > 0) {
        return mem;
      }

      return input.sqlite.getStats(args);
    },

    async clearProject(args: ClearSymbolIndexProjectInput) {
      await input.sqlite.clearProject(args);
      await input.memory.clearProject(args);
    },
  };
};

export { createHybridSymbolIndexRepository };
