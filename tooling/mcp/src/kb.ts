import type { Db } from './db';
import { sql } from 'drizzle-orm';

export type Id = number;

export type PointerInput = {
  kind: string;
  repoPath: string;
  spanStart?: number;
  spanEnd?: number;
  rev: string;
};

export type EntityInput = {
  entityKey: string;
  entityType: string;
  packageName?: string;
  displayName?: string;
  summaryText?: string;
  pointerId?: Id;
  meta?: Record<string, unknown>;
};

export type ChunkInput = {
  entityId: Id;
  chunkType: string;
  chunkKey: string;
  payloadJson?: Record<string, unknown>;
  payloadText: string;
  pointerId?: Id;
  ingestRunId: Id;
};

export type EdgeInput = {
  srcEntityId: Id;
  dstEntityId: Id;
  edgeType: string;
  strength: string;
  pointerId?: Id;
  ingestRunId: Id;
  meta?: Record<string, unknown>;
};

function clampPayloadText(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= 4000) return trimmed;
  return `${trimmed.slice(0, 3990)}…`;
}

export function createKb(db: Db) {
  const typeCache = new Map<string, Id>();

  async function ensureType(table: 'entity_type' | 'chunk_type' | 'edge_type' | 'strength_type', name: string): Promise<Id> {
    const key = `${table}:${name}`;
    const cached = typeCache.get(key);
    if (cached) return cached;

    const insert = await db.execute(
      sql`INSERT INTO ${sql.raw(table)} (name) VALUES (${name}) ON CONFLICT (name) DO NOTHING RETURNING id`,
    );

    let id: Id | undefined;
    if (insert.rows[0] && typeof (insert.rows[0] as { id?: unknown }).id === 'number') {
      id = (insert.rows[0] as { id: number }).id;
    } else {
      const select = await db.execute(sql`SELECT id FROM ${sql.raw(table)} WHERE name = ${name}`);
      const row = select.rows[0] as { id?: unknown } | undefined;
      if (!row || typeof row.id !== 'number') throw new Error(`Failed to resolve type id for ${table}:${name}`);
      id = row.id;
    }

    typeCache.set(key, id);
    return id;
  }

  async function upsertPointer(input: PointerInput): Promise<Id> {
    const result = await db.execute(sql`
      INSERT INTO pointer (kind, repo_path, span_start, span_end, rev)
      VALUES (${input.kind}, ${input.repoPath}, ${input.spanStart ?? null}, ${input.spanEnd ?? null}, ${input.rev})
      ON CONFLICT (kind, repo_path, span_start, span_end, rev)
      DO UPDATE SET kind = EXCLUDED.kind
      RETURNING id
    `);
    const id = (result.rows[0] as { id?: unknown } | undefined)?.id;
    if (typeof id !== 'number') throw new Error('Failed to upsert pointer');
    return id;
  }

  async function upsertEntity(input: EntityInput, runId: Id): Promise<Id> {
    const entityTypeId = await ensureType('entity_type', input.entityType);
    const metaJson = JSON.stringify(input.meta ?? {});
    const result = await db.execute(sql`
      INSERT INTO entity (
        entity_key,
        entity_type_id,
        package_name,
        display_name,
        summary_text,
        pointer_id,
        created_run_id,
        updated_run_id,
        meta
      )
      VALUES (
        ${input.entityKey},
        ${entityTypeId},
        ${input.packageName ?? null},
        ${input.displayName ?? null},
        ${input.summaryText ?? null},
        ${input.pointerId ?? null},
        ${runId},
        ${runId},
        ${metaJson}::jsonb
      )
      ON CONFLICT (entity_key)
      DO UPDATE SET
        entity_type_id = EXCLUDED.entity_type_id,
        package_name = EXCLUDED.package_name,
        display_name = EXCLUDED.display_name,
        summary_text = EXCLUDED.summary_text,
        pointer_id = EXCLUDED.pointer_id,
        updated_run_id = ${runId},
        updated_at = now(),
        meta = EXCLUDED.meta
      RETURNING id
    `);
    const id = (result.rows[0] as { id?: unknown } | undefined)?.id;
    if (typeof id !== 'number') throw new Error(`Failed to upsert entity: ${input.entityKey}`);
    return id;
  }

  async function upsertChunk(input: ChunkInput): Promise<Id> {
    const chunkTypeId = await ensureType('chunk_type', input.chunkType);
    const payloadJson = JSON.stringify(input.payloadJson ?? {});
    const result = await db.execute(sql`
      INSERT INTO chunk (
        entity_id,
        chunk_type_id,
        chunk_key,
        payload_json,
        payload_text,
        pointer_id,
        ingest_run_id
      )
      VALUES (
        ${input.entityId},
        ${chunkTypeId},
        ${input.chunkKey},
        ${payloadJson}::jsonb,
        ${clampPayloadText(input.payloadText)},
        ${input.pointerId ?? null},
        ${input.ingestRunId}
      )
      ON CONFLICT (entity_id, chunk_type_id, chunk_key)
      DO UPDATE SET
        payload_json = EXCLUDED.payload_json,
        payload_text = EXCLUDED.payload_text,
        pointer_id = EXCLUDED.pointer_id,
        ingest_run_id = EXCLUDED.ingest_run_id
      RETURNING id
    `);
    const id = (result.rows[0] as { id?: unknown } | undefined)?.id;
    if (typeof id !== 'number') throw new Error('Failed to upsert chunk');
    return id;
  }

  async function upsertEdge(input: EdgeInput): Promise<Id> {
    const edgeTypeId = await ensureType('edge_type', input.edgeType);
    const strengthId = await ensureType('strength_type', input.strength);
    const metaJson = JSON.stringify(input.meta ?? {});
    const result = await db.execute(sql`
      INSERT INTO edge (
        src_entity_id,
        dst_entity_id,
        edge_type_id,
        strength_type_id,
        pointer_id,
        ingest_run_id,
        meta
      )
      VALUES (
        ${input.srcEntityId},
        ${input.dstEntityId},
        ${edgeTypeId},
        ${strengthId},
        ${input.pointerId ?? null},
        ${input.ingestRunId},
        ${metaJson}::jsonb
      )
      ON CONFLICT (src_entity_id, dst_entity_id, edge_type_id, strength_type_id)
      DO UPDATE SET
        pointer_id = EXCLUDED.pointer_id,
        ingest_run_id = EXCLUDED.ingest_run_id,
        meta = EXCLUDED.meta
      RETURNING id
    `);
    const id = (result.rows[0] as { id?: unknown } | undefined)?.id;
    if (typeof id !== 'number') throw new Error('Failed to upsert edge');
    return id;
  }

  async function beginRun(params: {
    repoRev: string;
    tool: string;
    toolVersion: string;
    meta?: Record<string, unknown>;
  }): Promise<Id> {
    const metaJson = JSON.stringify(params.meta ?? {});
    const result = await db.execute(sql`
      INSERT INTO ingest_run (repo_rev, tool, tool_version, status, meta)
      VALUES (${params.repoRev}, ${params.tool}, ${params.toolVersion}, 'running', ${metaJson}::jsonb)
      RETURNING id
    `);
    const id = (result.rows[0] as { id?: unknown } | undefined)?.id;
    if (typeof id !== 'number') throw new Error('Failed to create ingest run');
    return id;
  }

  async function finishRun(runId: Id, status: 'succeeded' | 'failed', meta?: Record<string, unknown>): Promise<void> {
    const metaJson = JSON.stringify(meta ?? {});
    await db.execute(sql`
      UPDATE ingest_run
      SET status = ${status},
          finished_at = now(),
          meta = meta || ${metaJson}::jsonb
      WHERE id = ${runId}
    `);
  }

  return {
    ensureType,
    upsertPointer,
    upsertEntity,
    upsertChunk,
    upsertEdge,
    beginRun,
    finishRun,
  };
}
