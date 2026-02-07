import { afterAll, beforeAll, describe, expect, it } from 'bun:test';

import { createIntegrationClient } from './_harness';

import { eq, inArray } from 'drizzle-orm';

import { createDb } from '../../src/db';
import { readEnv } from '../../src/env';
import * as kb from '../../drizzle/schema';

const IS_REAL_DB = Bun.env.BUNNER_KB_TEST_REAL_DB === '1';
const describeReal = IS_REAL_DB ? describe : describe.skip;

type Seed = {
  runId: number;
  pointerAId: number;
  pointerBId: number;
  entityAKey: string;
  entityBKey: string;
  chunkId: number;
  edgeId: number;
};

async function requireTypeId(db: Awaited<ReturnType<typeof createDb>>, table: any, name: string): Promise<number> {
  const rows = await db.db.select({ id: table.id }).from(table).where(eq(table.name, name)).limit(1);
  const id = rows[0]?.id as number | undefined;
  if (!id) throw new Error(`[test] Missing type row: ${name}`);
  return id;
}

async function seedMinimalKb(): Promise<Seed> {
  if (!IS_REAL_DB) throw new Error('[test] seedMinimalKb() requires BUNNER_KB_TEST_REAL_DB=1');

  const env = readEnv(Bun.env);
  const db = await createDb(env.kbDatabaseUrl);

  try {
    // Assert schema exists (migrations applied)
    await db.db.select({ id: kb.ingestRun.id }).from(kb.ingestRun).limit(1);

    const entityAKey = 'test:entity:A';
    const entityBKey = 'test:entity:B';

    // Cleanup any prior runs (idempotent)
    const existingEntities = await db.db
      .select({ id: kb.entity.id, pointerId: kb.entity.pointerId })
      .from(kb.entity)
      .where(inArray(kb.entity.entityKey, [entityAKey, entityBKey]));

    const existingEntityIds = existingEntities.map((e) => e.id as number);
    const existingPointerIds = existingEntities
      .map((e) => e.pointerId as number | null)
      .filter((v): v is number => typeof v === 'number');

    if (existingEntityIds.length > 0) {
      // Cascades delete chunk/edge/edge_evidence via FK.
      await db.db.delete(kb.entity).where(inArray(kb.entity.id, existingEntityIds));
    }

    if (existingPointerIds.length > 0) {
      await db.db.delete(kb.pointer).where(inArray(kb.pointer.id, existingPointerIds));
    }

    const entityTypeId = await requireTypeId(db, kb.entityType, 'package');
    const chunkTypeId = await requireTypeId(db, kb.chunkType, 'summary');
    const edgeTypeId = await requireTypeId(db, kb.edgeType, 'depends_on');
    const strengthTypeId = await requireTypeId(db, kb.strengthType, 'contract');

    const run = await db.db
      .insert(kb.ingestRun)
      .values({
        repoRev: 'test-rev',
        tool: 'integration-test',
        toolVersion: '0.0.0',
        status: 'succeeded',
        meta: { source: 'realdb' },
      })
      .returning({ id: kb.ingestRun.id });

    const runId = run[0]?.id as number | undefined;
    if (!runId) throw new Error('[test] failed to create ingest_run');

    const pointerA = await db.db
      .insert(kb.pointer)
      .values({
        kind: 'file',
        repoPath: 'tooling/mcp/test/integration/realdb/seed-A',
        spanStart: 0,
        spanEnd: 1,
        rev: 'test-rev',
      })
      .returning({ id: kb.pointer.id });

    const pointerB = await db.db
      .insert(kb.pointer)
      .values({
        kind: 'file',
        repoPath: 'tooling/mcp/test/integration/realdb/seed-B',
        spanStart: 0,
        spanEnd: 1,
        rev: 'test-rev',
      })
      .returning({ id: kb.pointer.id });

    const pointerAId = pointerA[0]?.id as number | undefined;
    const pointerBId = pointerB[0]?.id as number | undefined;
    if (!pointerAId || !pointerBId) throw new Error('[test] failed to create pointers');

    const entityA = await db.db
      .insert(kb.entity)
      .values({
        entityKey: entityAKey,
        entityTypeId,
        packageName: 'testpkg',
        displayName: 'TestPkg A',
        summaryText: 'Seed entity A',
        pointerId: pointerAId,
        createdRunId: runId,
        updatedRunId: runId,
        meta: { seed: true },
      })
      .returning({ id: kb.entity.id });

    const entityB = await db.db
      .insert(kb.entity)
      .values({
        entityKey: entityBKey,
        entityTypeId,
        packageName: 'testpkg',
        displayName: 'TestPkg B',
        summaryText: 'Seed entity B',
        pointerId: pointerBId,
        createdRunId: runId,
        updatedRunId: runId,
        meta: { seed: true },
      })
      .returning({ id: kb.entity.id });

    const entityAId = entityA[0]?.id as number | undefined;
    const entityBId = entityB[0]?.id as number | undefined;
    if (!entityAId || !entityBId) throw new Error('[test] failed to create entities');

    const chunk = await db.db
      .insert(kb.chunk)
      .values({
        entityId: entityAId,
        chunkTypeId,
        chunkKey: 'summary',
        payloadJson: { hello: 'world' },
        payloadText: 'hello world from bunner',
        pointerId: pointerAId,
        ingestRunId: runId,
      })
      .returning({ id: kb.chunk.id });

    const chunkId = chunk[0]?.id as number | undefined;
    if (!chunkId) throw new Error('[test] failed to create chunk');

    const edge = await db.db
      .insert(kb.edge)
      .values({
        srcEntityId: entityAId,
        dstEntityId: entityBId,
        edgeTypeId,
        strengthTypeId,
        pointerId: pointerAId,
        ingestRunId: runId,
        meta: { seed: true },
      })
      .returning({ id: kb.edge.id });

    const edgeId = edge[0]?.id as number | undefined;
    if (!edgeId) throw new Error('[test] failed to create edge');

    // Evidence: link chunk to edge
    await db.db.insert(kb.edgeEvidence).values({ edgeId, chunkId }).onConflictDoNothing();

    return {
      runId,
      pointerAId,
      pointerBId,
      entityAKey,
      entityBKey,
      chunkId,
      edgeId,
    };
  } finally {
    await db.close({ timeout: 0 });
  }
}

// Real DB tests (opt-in): run with `BUNNER_KB_TEST_REAL_DB=1` and valid `BUNNER_KB_*` env.
// These tests validate end-to-end wiring against Postgres+pgvector.

describeReal('mcp/realdb', () => {
  let seed: Awaited<ReturnType<typeof seedMinimalKb>>;
  let client: Awaited<ReturnType<typeof createIntegrationClient>>['client'];
  let close: Awaited<ReturnType<typeof createIntegrationClient>>['close'];

  beforeAll(async () => {
    seed = await seedMinimalKb();

    const integration = await createIntegrationClient();
    client = integration.client;
    close = integration.close;
  });

  afterAll(async () => {
    await close?.();
  });

  it('kb_status reports schema + connectivity diagnostics', async () => {
    const res = await client.callTool({ name: 'kb_status', arguments: {} });
    const sc = (res as any).structuredContent;

    expect(sc?.schema?.ok).toBe(true);
    expect(typeof sc?.connectivity?.primary?.ok).toBe('boolean');
    expect(Array.isArray(sc?.connectivity?.replicas)).toBe(true);

    for (const r of sc.connectivity.replicas) {
      expect(r.target).toBeDefined();
      expect(typeof r.target.host).toBe('string');
      expect(typeof r.target.port).toBe('string');
      expect(typeof r.target.database).toBe('string');
      expect(typeof r.ok).toBe('boolean');
    }
  });

  it('list_packages includes seeded packageName', async () => {
    const res = await client.callTool({ name: 'list_packages', arguments: {} });
    const pkgs = (res as any).structuredContent?.packages;

    expect(Array.isArray(pkgs)).toBe(true);
    expect(pkgs.some((p: any) => p.package_name === 'testpkg')).toBe(true);
  });

  it('search finds seeded chunk text', async () => {
    const res = await client.callTool({ name: 'search', arguments: { query: 'hello', limit: 10 } });
    const hits = (res as any).structuredContent?.hits;

    expect(Array.isArray(hits)).toBe(true);
    expect(hits.length).toBeGreaterThan(0);
  });

  it('describe returns entity and pointer fields for seeded entity', async () => {
    const res = await client.callTool({ name: 'describe', arguments: { entityKey: seed.entityAKey } });
    const entity = (res as any).structuredContent?.entity;

    expect(entity?.entity_key).toBe(seed.entityAKey);
    expect(entity?.pointer_id).toBe(seed.pointerAId);
  });

  it('relations returns seeded edge', async () => {
    const res = await client.callTool({ name: 'relations', arguments: { entityKey: seed.entityAKey, limit: 50 } });
    const edges = (res as any).structuredContent?.edges;

    expect(Array.isArray(edges)).toBe(true);
    expect(edges.length).toBeGreaterThan(0);
  });

  it('chunk_get returns seeded chunk', async () => {
    const res = await client.callTool({ name: 'chunk_get', arguments: { chunkId: seed.chunkId } });
    const chunk = (res as any).structuredContent?.chunk;

    expect(chunk?.id).toBe(seed.chunkId);
  });

  it('chunks_by_entity returns seeded chunk id', async () => {
    const res = await client.callTool({ name: 'chunks_by_entity', arguments: { entityKey: seed.entityAKey, limit: 50 } });
    const chunks = (res as any).structuredContent?.chunks;

    expect(Array.isArray(chunks)).toBe(true);
    expect(chunks.some((c: any) => c.id === seed.chunkId)).toBe(true);
  });

  it('pointer_describe returns seeded pointer', async () => {
    const res = await client.callTool({ name: 'pointer_describe', arguments: { pointerId: seed.pointerAId } });
    const pointer = (res as any).structuredContent?.pointer;

    expect(pointer?.id).toBe(seed.pointerAId);
    expect(pointer?.repo_path).toContain('tooling/mcp/test/integration/realdb/seed-A');
  });

  it('edge_evidence_list returns evidence for seeded edge', async () => {
    const res = await client.callTool({ name: 'edge_evidence_list', arguments: { edgeId: seed.edgeId } });
    const evidence = (res as any).structuredContent?.evidence;

    expect(Array.isArray(evidence)).toBe(true);
    expect(evidence.length).toBeGreaterThan(0);
  });

  it('ingest_runs_list includes the seeded ingest run', async () => {
    const res = await client.callTool({ name: 'ingest_runs_list', arguments: { limit: 10 } });
    const runs = (res as any).structuredContent?.runs;

    expect(Array.isArray(runs)).toBe(true);
    expect(runs.some((r: any) => r.id === seed.runId)).toBe(true);
  });

  it('ingest_run_get returns the seeded ingest run', async () => {
    const res = await client.callTool({ name: 'ingest_run_get', arguments: { runId: seed.runId } });
    const run = (res as any).structuredContent?.run;

    expect(run?.id).toBe(seed.runId);
    expect(run?.tool).toBe('integration-test');
  });

  it('list_*_types returns the expected worlds', async () => {
    const entityTypes = await client.callTool({ name: 'list_entity_types', arguments: {} });
    const et = (entityTypes as any).structuredContent?.entityTypes;
    expect(Array.isArray(et)).toBe(true);
    expect(et.some((r: any) => r.name === 'package')).toBe(true);

    const chunkTypes = await client.callTool({ name: 'list_chunk_types', arguments: {} });
    const ct = (chunkTypes as any).structuredContent?.chunkTypes;
    expect(Array.isArray(ct)).toBe(true);
    expect(ct.some((r: any) => r.name === 'summary')).toBe(true);

    const edgeTypes = await client.callTool({ name: 'list_edge_types', arguments: {} });
    const edgeT = (edgeTypes as any).structuredContent?.edgeTypes;
    expect(Array.isArray(edgeT)).toBe(true);
    expect(edgeT.some((r: any) => r.name === 'depends_on')).toBe(true);

    const strengthTypes = await client.callTool({ name: 'list_strength_types', arguments: {} });
    const st = (strengthTypes as any).structuredContent?.strengthTypes;
    expect(Array.isArray(st)).toBe(true);
    expect(st.some((r: any) => r.name === 'contract')).toBe(true);
  });

  it('returns null/empty for missing resources', async () => {
    const missingEntity = await client.callTool({ name: 'describe', arguments: { entityKey: 'test:entity:__missing__' } });
    expect((missingEntity as any).structuredContent?.entity).toBeNull();

    const missingChunk = await client.callTool({ name: 'chunk_get', arguments: { chunkId: seed.chunkId + 999999 } });
    expect((missingChunk as any).structuredContent?.chunk).toBeNull();

    const missingPointer = await client.callTool({ name: 'pointer_describe', arguments: { pointerId: seed.pointerAId + 999999 } });
    expect((missingPointer as any).structuredContent?.pointer).toBeNull();

    const missingEvidence = await client.callTool({ name: 'edge_evidence_list', arguments: { edgeId: seed.edgeId + 999999 } });
    const evidence = (missingEvidence as any).structuredContent?.evidence;
    expect(Array.isArray(evidence)).toBe(true);
    expect(evidence.length).toBe(0);

    const emptySearch = await client.callTool({ name: 'search', arguments: { query: '___definitely_no_match___', limit: 5 } });
    const hits = (emptySearch as any).structuredContent?.hits;
    expect(Array.isArray(hits)).toBe(true);
    expect(hits.length).toBe(0);
  });
});
