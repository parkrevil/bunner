// MUST: MUST-1
import type { ArtifactRepository, GetArtifactInput, SetArtifactInput } from '../../ports/artifact.repository';

interface HybridArtifactDeps {
  readonly memory: ArtifactRepository;
  readonly sqlite: ArtifactRepository;
}

const createHybridArtifactRepository = (input: HybridArtifactDeps): ArtifactRepository => {
  const { memory, sqlite } = input;

  return {
    async getArtifact<T>(args: GetArtifactInput): Promise<T | null> {
      const fromMemory = await memory.getArtifact<T>(args);

      if (fromMemory !== null) {
        return fromMemory;
      }

      const fromSqlite = await sqlite.getArtifact<T>(args);

      if (fromSqlite !== null) {
        await memory.setArtifact({ ...args, value: fromSqlite });
      }

      return fromSqlite;
    },

    async setArtifact<T>(args: SetArtifactInput<T>): Promise<void> {
      await memory.setArtifact(args);
      await sqlite.setArtifact(args);
    },
  };
};

export { createHybridArtifactRepository };
