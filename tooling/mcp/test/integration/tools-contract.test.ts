import { describe, expect, it } from 'bun:test';

import { createIntegrationClient } from './_harness';

describe('mcp/tools-contract', () => {
  it('exposes expected tools via listTools()', async () => {
    const { client, close } = await createIntegrationClient();
    try {
      const { tools } = await client.listTools();
      const names = new Set(tools.map((t) => t.name));

      for (const required of [
        'list_packages',
        'search',
        'pointer_describe',
        'chunk_get',
        'chunks_by_entity',
        'ingest_runs_list',
        'ingest_run_get',
        'kb_status',
        'edge_evidence_list',
        'list_entity_types',
        'list_chunk_types',
        'list_edge_types',
        'list_strength_types',
        'describe',
        'relations',
        'ingest',
      ]) {
        expect(names.has(required)).toBe(true);
      }

      for (const t of tools) {
        // Contract guardrails: strict object schemas.
        const schema = (t as any).inputSchema;
        expect(schema).toBeDefined();
        expect(schema.type).toBe('object');
        expect(schema.additionalProperties).toBe(false);
      }
    } finally {
      await close();
    }
  });
});
