import { integer, sqliteTable, text, primaryKey, index } from 'drizzle-orm/sqlite-core';

export const files = sqliteTable(
  'files',
  {
    projectKey: text('projectKey').notNull(),
    filePath: text('filePath').notNull(),
    mtimeMs: integer('mtimeMs').notNull(),
    size: integer('size').notNull(),
    contentHash: text('contentHash').notNull(),
    updatedAt: integer('updatedAt').notNull(),
  },
  table => [
    primaryKey({ columns: [table.projectKey, table.filePath] }),
    index('idx_files_projectKey').on(table.projectKey),
  ],
);

export const artifacts = sqliteTable(
  'artifacts',
  {
    projectKey: text('projectKey').notNull(),
    kind: text('kind').notNull(),
    artifactKey: text('artifactKey').notNull(),
    inputsDigest: text('inputsDigest').notNull(),
    createdAt: integer('createdAt').notNull(),
    payloadJson: text('payloadJson').notNull(),
  },
  table => [
    primaryKey({ columns: [table.projectKey, table.kind, table.artifactKey, table.inputsDigest] }),
    index('idx_artifacts_projectKey_kind').on(table.projectKey, table.kind),
    index('idx_artifacts_createdAt').on(table.createdAt),
  ],
);

export const reports = sqliteTable(
  'reports',
  {
    projectKey: text('projectKey').notNull(),
    reportKey: text('reportKey').notNull(),
    createdAt: integer('createdAt').notNull(),
    reportJson: text('reportJson').notNull(),
  },
  table => [primaryKey({ columns: [table.projectKey, table.reportKey] })],
);
