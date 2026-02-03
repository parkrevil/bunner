import type {
  IndexedSymbol,
  IndexedFileInfo,
  GetIndexedFileInput,
  ReplaceFileSymbolsInput,
  SearchSymbolsInput,
  GetSymbolIndexStatsInput,
  ClearSymbolIndexProjectInput,
  SymbolIndexRepository,
  SymbolIndexStats,
  SymbolMatch,
} from '../../ports/symbol-index.repository';

interface FileMeta {
  readonly contentHash: string;
  readonly indexedAt: number;
  readonly symbolCount: number;
}

interface ProjectState {
  readonly files: Map<string, FileMeta>;
  readonly symbolsByFile: Map<string, ReadonlyArray<IndexedSymbol>>;
}

const createInMemorySymbolIndexRepository = (): SymbolIndexRepository => {
  const projects = new Map<string, ProjectState>();

  const getProject = (projectKey: string): ProjectState => {
    const existing = projects.get(projectKey);

    if (existing) {
      return existing;
    }

    const state: ProjectState = {
      files: new Map(),
      symbolsByFile: new Map(),
    };

    projects.set(projectKey, state);

    return state;
  };

  return {
    async getIndexedFile({ projectKey, filePath }: GetIndexedFileInput): Promise<IndexedFileInfo | null> {
      const state = getProject(projectKey);

      return Promise.resolve(state.files.get(filePath) ?? null);
    },

    async replaceFileSymbols({ projectKey, filePath, contentHash, indexedAt, symbols }: ReplaceFileSymbolsInput): Promise<void> {
      const state = getProject(projectKey);

      state.files.set(filePath, { contentHash, indexedAt, symbolCount: symbols.length });
      state.symbolsByFile.set(filePath, [...symbols]);

      return Promise.resolve();
    },

    async search({ projectKey, query, limit }: SearchSymbolsInput): Promise<ReadonlyArray<SymbolMatch>> {
      const trimmed = query.trim();

      if (trimmed.length === 0) {
        return Promise.resolve([]);
      }

      const max = limit !== undefined && limit > 0 ? Math.min(500, Math.floor(limit)) : 50;
      const q = trimmed.toLowerCase();
      const state = getProject(projectKey);
      const out: SymbolMatch[] = [];

      for (const [filePath, symbols] of state.symbolsByFile.entries()) {
        for (const s of symbols) {
          if (s.name.toLowerCase().includes(q)) {
            out.push({ filePath, kind: s.kind, name: s.name, span: s.span });

            if (out.length >= max) {
              return Promise.resolve(out);
            }
          }
        }
      }

      return Promise.resolve(out);
    },

    async getStats({ projectKey }: GetSymbolIndexStatsInput): Promise<SymbolIndexStats> {
      const state = getProject(projectKey);
      let symbolCount = 0;
      let lastIndexedAt: number | null = null;

      for (const meta of state.files.values()) {
        symbolCount += meta.symbolCount;

        if (lastIndexedAt === null || meta.indexedAt > lastIndexedAt) {
          lastIndexedAt = meta.indexedAt;
        }
      }

      return Promise.resolve({
        indexedFileCount: state.files.size,
        symbolCount,
        lastIndexedAt,
      });
    },

    async clearProject({ projectKey }: ClearSymbolIndexProjectInput): Promise<void> {
      projects.delete(projectKey);

      return Promise.resolve();
    },
  };
};

export { createInMemorySymbolIndexRepository };
