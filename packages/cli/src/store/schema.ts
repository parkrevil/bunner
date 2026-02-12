import {
  sqliteTable,
  text,
  integer,
  index,
  primaryKey,
} from 'drizzle-orm/sqlite-core';

// ---------------------------------------------------------------------------
// metadata
// ---------------------------------------------------------------------------
export const metadata = sqliteTable('metadata', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

// ---------------------------------------------------------------------------
// card
// ---------------------------------------------------------------------------
export const card = sqliteTable(
  'card',
  {
    key: text('key').primaryKey(),
    type: text('type').notNull(),
    summary: text('summary').notNull(),
    status: text('status').notNull(),
    keywords: text('keywords'),
    constraintsJson: text('constraints_json'),
    body: text('body'),
    filePath: text('file_path').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('idx_card_type').on(table.type),
    index('idx_card_status').on(table.status),
    index('idx_card_file_path').on(table.filePath),
  ],
);

// ---------------------------------------------------------------------------
// keyword
// ---------------------------------------------------------------------------
export const keyword = sqliteTable('keyword', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
});

// ---------------------------------------------------------------------------
// card_keyword (N:M)
// ---------------------------------------------------------------------------
export const cardKeyword = sqliteTable(
  'card_keyword',
  {
    cardKey: text('card_key')
      .notNull()
      .references(() => card.key),
    keywordId: integer('keyword_id')
      .notNull()
      .references(() => keyword.id),
  },
  (table) => [
    primaryKey({ columns: [table.cardKey, table.keywordId] }),
    index('idx_card_keyword_card').on(table.cardKey),
    index('idx_card_keyword_keyword').on(table.keywordId),
  ],
);

// ---------------------------------------------------------------------------
// code_entity
// ---------------------------------------------------------------------------
export const codeEntity = sqliteTable(
  'code_entity',
  {
    entityKey: text('entity_key').primaryKey(),
    filePath: text('file_path').notNull(),
    symbolName: text('symbol_name'),
    kind: text('kind').notNull(),
    signature: text('signature'),
    fingerprint: text('fingerprint'),
    contentHash: text('content_hash').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('idx_code_entity_file_path').on(table.filePath),
    index('idx_code_entity_kind').on(table.kind),
  ],
);

// ---------------------------------------------------------------------------
// card_relation
// ---------------------------------------------------------------------------
export const cardRelation = sqliteTable(
  'card_relation',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    type: text('type').notNull(),
    srcCardKey: text('src_card_key')
      .notNull()
      .references(() => card.key),
    dstCardKey: text('dst_card_key')
      .notNull()
      .references(() => card.key),
    isReverse: integer('is_reverse', { mode: 'boolean' }).notNull().default(false),
    metaJson: text('meta_json'),
  },
  (table) => [
    index('idx_card_relation_src').on(table.srcCardKey),
    index('idx_card_relation_dst').on(table.dstCardKey),
    index('idx_card_relation_type').on(table.type),
  ],
);

// ---------------------------------------------------------------------------
// card_code_link
// ---------------------------------------------------------------------------
export const cardCodeLink = sqliteTable(
  'card_code_link',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    type: text('type').notNull(),
    cardKey: text('card_key')
      .notNull()
      .references(() => card.key),
    entityKey: text('entity_key')
      .notNull()
      .references(() => codeEntity.entityKey),
    filePath: text('file_path').notNull(),
    symbolName: text('symbol_name'),
    metaJson: text('meta_json'),
  },
  (table) => [
    index('idx_card_code_link_card').on(table.cardKey),
    index('idx_card_code_link_entity').on(table.entityKey),
    index('idx_card_code_link_file').on(table.filePath),
  ],
);

// ---------------------------------------------------------------------------
// code_relation
// ---------------------------------------------------------------------------
export const codeRelation = sqliteTable(
  'code_relation',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    type: text('type').notNull(),
    srcEntityKey: text('src_entity_key')
      .notNull()
      .references(() => codeEntity.entityKey),
    dstEntityKey: text('dst_entity_key')
      .notNull()
      .references(() => codeEntity.entityKey),
    metaJson: text('meta_json'),
  },
  (table) => [
    index('idx_code_relation_src').on(table.srcEntityKey),
    index('idx_code_relation_dst').on(table.dstEntityKey),
    index('idx_code_relation_type').on(table.type),
  ],
);

// ---------------------------------------------------------------------------
// file_state
// ---------------------------------------------------------------------------
export const fileState = sqliteTable('file_state', {
  path: text('path').primaryKey(),
  contentHash: text('content_hash').notNull(),
  mtime: text('mtime').notNull(),
  lastIndexedAt: text('last_indexed_at').notNull(),
});
