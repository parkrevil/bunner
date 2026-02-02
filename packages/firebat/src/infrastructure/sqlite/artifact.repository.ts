import type { ArtifactRepository } from '../../ports/artifact.repository';

import { and, eq } from 'drizzle-orm';

import type { FirebatDrizzleDb } from './drizzle-db';
import { artifacts } from './schema';

const createSqliteArtifactRepository = (db: FirebatDrizzleDb): ArtifactRepository => {
  return {
    async getArtifact<T>(input: {
      projectKey: string;
      kind: string;
      artifactKey: string;
      inputsDigest: string;
    }): Promise<T | null> {
      const { projectKey, kind, artifactKey, inputsDigest } = input;
      const row = db
        .select({ payloadJson: artifacts.payloadJson })
        .from(artifacts)
        .where(
          and(
            eq(artifacts.projectKey, projectKey),
            eq(artifacts.kind, kind),
            eq(artifacts.artifactKey, artifactKey),
            eq(artifacts.inputsDigest, inputsDigest),
          ),
        )
        .get();

      if (!row) {
        return null;
      }

      try {
        return JSON.parse(row.payloadJson) as T;
      } catch {
        return null;
      }
    },

    async setArtifact<T>(input: {
      projectKey: string;
      kind: string;
      artifactKey: string;
      inputsDigest: string;
      value: T;
    }): Promise<void> {
      const { projectKey, kind, artifactKey, inputsDigest, value } = input;
      const createdAt = Date.now();
      const payloadJson = JSON.stringify(value);

      db.insert(artifacts)
        .values({
          projectKey,
          kind,
          artifactKey,
          inputsDigest,
          createdAt,
          payloadJson,
        })
        .onConflictDoUpdate({
          target: [artifacts.projectKey, artifacts.kind, artifacts.artifactKey, artifacts.inputsDigest],
          set: { createdAt, payloadJson },
        })
        .run();
    },
  };
};

export { createSqliteArtifactRepository };
