import type { ArtifactRepository } from '../../ports/artifact.repository';

type ArtifactRow = {
  value: unknown;
};

const keyOf = (input: { projectKey: string; kind: string; artifactKey: string; inputsDigest: string }): string =>
  `${input.projectKey}|${input.kind}|${input.artifactKey}|${input.inputsDigest}`;

const createInMemoryArtifactRepository = (): ArtifactRepository => {
  const store = new Map<string, ArtifactRow>();

  return {
    async getArtifact<T>(input: {
      projectKey: string;
      kind: string;
      artifactKey: string;
      inputsDigest: string;
    }): Promise<T | null> {
      const { projectKey, kind, artifactKey, inputsDigest } = input;
      const row = store.get(keyOf({ projectKey, kind, artifactKey, inputsDigest }));
      return (row?.value as T | undefined) ?? null;
    },

    async setArtifact<T>(input: {
      projectKey: string;
      kind: string;
      artifactKey: string;
      inputsDigest: string;
      value: T;
    }): Promise<void> {
      const { projectKey, kind, artifactKey, inputsDigest, value } = input;
      store.set(keyOf({ projectKey, kind, artifactKey, inputsDigest }), { value });
    },
  };
};

export { createInMemoryArtifactRepository };
