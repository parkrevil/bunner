import { sql } from 'drizzle-orm';
import {
	boolean,
	integer,
	index,
	jsonb,
	pgTable,
	primaryKey,
	serial,
	smallint,
	smallserial,
	text,
	timestamp,
	unique,
	customType,
} from 'drizzle-orm/pg-core';

// NOTE
// - SQL migrations are SSOT for schema creation.
// - This file exists to provide a typed schema for Drizzle query builder.
// - Matches MCP_PLAN §2.2 (KB v2 design).

// ── Custom types ─────────────────────────────────────────────

export const tsvector = customType<{ data: unknown; driverData: unknown }>({
	dataType() {
		return 'tsvector';
	},
});

export const vector = customType<{ data: unknown; driverData: unknown }>({
	dataType() {
		return 'vector';
	},
});

// ── Type tables (Seed Data) ──────────────────────────────────

export const entityType = pgTable('entity_type', {
	id: smallserial('id').primaryKey(),
	name: text('name').notNull().unique(),
});

export const factType = pgTable('fact_type', {
	id: smallserial('id').primaryKey(),
	name: text('name').notNull().unique(),
});

export const relationType = pgTable('relation_type', {
	id: smallserial('id').primaryKey(),
	name: text('name').notNull().unique(),
});

export const strengthType = pgTable('strength_type', {
	id: smallserial('id').primaryKey(),
	name: text('name').notNull().unique(),
	rank: smallint('rank').notNull().default(0),
});

// ── workspace ────────────────────────────────────────────────

export const workspace = pgTable('workspace', {
	id: text('id').primaryKey(),                               // sha256(hostname+repo_root)[:16]
	hostname: text('hostname').notNull(),
	repoRoot: text('repo_root').notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── sync_run ─────────────────────────────────────────────────

export const syncRun = pgTable('sync_run', {
	id: serial('id').primaryKey(),
	workspaceId: text('workspace_id').notNull().references(() => workspace.id),
	trigger: text('trigger').notNull(),                        // startup/watch/manual/read_through
	status: text('status').notNull(),                          // running/completed/failed
	startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
	finishedAt: timestamp('finished_at', { withTimezone: true }),
	stats: jsonb('stats').notNull().default(sql`'{}'::jsonb`),
	errors: jsonb('errors').notNull().default(sql`'[]'::jsonb`),
});

// ── entity ───────────────────────────────────────────────────

export const entity = pgTable('entity', {
	id: serial('id').primaryKey(),
	workspaceId: text('workspace_id').notNull().references(() => workspace.id),
	entityKey: text('entity_key').notNull(),
	entityTypeId: smallint('entity_type_id').notNull().references(() => entityType.id),
	summary: text('summary'),
	meta: jsonb('meta').notNull().default(sql`'{}'::jsonb`),
	isDeleted: boolean('is_deleted').notNull().default(false),
	lastSeenRun: integer('last_seen_run').references(() => syncRun.id),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
	unique('entity_workspace_key').on(t.workspaceId, t.entityKey),
]);

// ── source ───────────────────────────────────────────────────

export const source = pgTable('source', {
	id: serial('id').primaryKey(),
	workspaceId: text('workspace_id').notNull().references(() => workspace.id),
	entityId: integer('entity_id').notNull().references(() => entity.id, { onDelete: 'cascade' }),
	kind: text('kind').notNull(),                              // spec/code/test/config/doc
	filePath: text('file_path').notNull(),
	spanStart: integer('span_start'),
	spanEnd: integer('span_end'),
	contentHash: text('content_hash').notNull(),                // SHA-256
}, (t) => [
	unique('source_workspace_loc').on(t.workspaceId, t.kind, t.filePath, t.spanStart, t.spanEnd),
]);

// ── fact ─────────────────────────────────────────────────────

export const fact = pgTable('fact', {
	id: serial('id').primaryKey(),
	entityId: integer('entity_id').notNull().references(() => entity.id, { onDelete: 'cascade' }),
	factTypeId: smallint('fact_type_id').notNull().references(() => factType.id),
	factKey: text('fact_key').notNull(),
	payloadText: text('payload_text'),
	payloadJson: jsonb('payload_json').notNull().default(sql`'{}'::jsonb`),
	contentHash: text('content_hash'),
	// generated column — kept here for typed querying
	payloadTsv: tsvector('payload_tsv'),
}, (t) => [
	unique('fact_entity_type_key').on(t.entityId, t.factTypeId, t.factKey),
	index('fact_entity_id_idx').on(t.entityId),
]);

// ── relation ─────────────────────────────────────────────────

export const relation = pgTable('relation', {
	id: serial('id').primaryKey(),
	srcEntityId: integer('src_entity_id').notNull().references(() => entity.id, { onDelete: 'cascade' }),
	dstEntityId: integer('dst_entity_id').notNull().references(() => entity.id, { onDelete: 'cascade' }),
	relationTypeId: smallint('relation_type_id').notNull().references(() => relationType.id),
	strengthTypeId: smallint('strength_type_id').notNull().references(() => strengthType.id),
	meta: jsonb('meta').notNull().default(sql`'{}'::jsonb`),
}, (t) => [
	unique('relation_unique').on(t.srcEntityId, t.dstEntityId, t.relationTypeId, t.strengthTypeId),
]);

// ── relation_evidence ────────────────────────────────────────

export const relationEvidence = pgTable(
	'relation_evidence',
	{
		relationId: integer('relation_id').notNull().references(() => relation.id, { onDelete: 'cascade' }),
		factId: integer('fact_id').notNull().references(() => fact.id, { onDelete: 'cascade' }),
	},
	(t) => [primaryKey({ columns: [t.relationId, t.factId], name: 'relation_evidence_pkey' })],
);

// ── sync_event (Audit Trail) ─────────────────────────────────

export const syncEvent = pgTable('sync_event', {
	id: serial('id').primaryKey(),
	runId: integer('run_id').notNull().references(() => syncRun.id, { onDelete: 'cascade' }),
	entityId: integer('entity_id').notNull().references(() => entity.id, { onDelete: 'cascade' }),
	action: text('action').notNull(),                          // created/updated/deleted/restored
	prevContentHash: text('prev_content_hash'),
	newContentHash: text('new_content_hash'),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

