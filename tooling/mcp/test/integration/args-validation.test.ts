import { describe, expect, it } from 'bun:test';

import { createHermeticEnvSource, createIntegrationClient } from './_harness';

describe('mcp/contract/arguments', () => {
  it('returns UNKNOWN_TOOL for unrecognized tools', async () => {
    const { client, close } = await createIntegrationClient({ envSource: createHermeticEnvSource() });
    try {
      const res = await client.callTool({ name: '___no_such_tool___', arguments: {} });
      const sc = (res as any).structuredContent;
      expect(sc?.error?.code).toBe('UNKNOWN_TOOL');
      expect(sc?.error?.tool).toBe('___no_such_tool___');
    } finally {
      await close();
    }
  });

  it('returns UNKNOWN_TOOL without reading env', async () => {
    const { client, close } = await createIntegrationClient({ envSource: {} });
    try {
      const res = await client.callTool({ name: '___no_such_tool___', arguments: {} });
      const sc = (res as any).structuredContent;
      expect(sc?.error?.code).toBe('UNKNOWN_TOOL');
      expect(sc?.error?.tool).toBe('___no_such_tool___');
    } finally {
      await close();
    }
  });

  it('returns INVALID_ARGUMENTS when additionalProperties are provided', async () => {
    const { client, close } = await createIntegrationClient({ envSource: createHermeticEnvSource() });
    try {
      const res = await client.callTool({ name: 'list_packages', arguments: { extra: true } as any });
      const sc = (res as any).structuredContent;
      expect(sc?.error?.code).toBe('INVALID_ARGUMENTS');
      expect(sc?.error?.tool).toBe('list_packages');
      expect(Array.isArray(sc?.error?.issues)).toBe(true);
    } finally {
      await close();
    }
  });

  it('returns INVALID_ARGUMENTS for missing required fields', async () => {
    const { client, close } = await createIntegrationClient({ envSource: createHermeticEnvSource() });
    try {
      const res = await client.callTool({ name: 'search', arguments: { limit: 1 } as any });
      const sc = (res as any).structuredContent;
      expect(sc?.error?.code).toBe('INVALID_ARGUMENTS');
      expect(sc?.error?.tool).toBe('search');
    } finally {
      await close();
    }
  });

  it('returns INVALID_ARGUMENTS for boundary violations (limit)', async () => {
    const { client, close } = await createIntegrationClient({ envSource: createHermeticEnvSource() });
    try {
      const tooHigh = await client.callTool({ name: 'chunks_by_entity', arguments: { entityKey: 'x', limit: 201 } });
      expect((tooHigh as any).structuredContent?.error?.code).toBe('INVALID_ARGUMENTS');

      const tooLow = await client.callTool({ name: 'search', arguments: { query: 'x', limit: 0 } });
      expect((tooLow as any).structuredContent?.error?.code).toBe('INVALID_ARGUMENTS');
    } finally {
      await close();
    }
  });

  it('returns INVALID_ARGUMENTS for wrong id formats', async () => {
    const { client, close } = await createIntegrationClient({ envSource: createHermeticEnvSource() });
    try {
      const res = await client.callTool({ name: 'pointer_describe', arguments: { pointerId: 'abc' } as any });
      expect((res as any).structuredContent?.error?.code).toBe('INVALID_ARGUMENTS');
    } finally {
      await close();
    }
  });

  it('returns NOT_IMPLEMENTED for search mode=hybrid without requiring schema', async () => {
    const { client, close } = await createIntegrationClient({ envSource: createHermeticEnvSource() });
    try {
      const res = await client.callTool({
        name: 'search',
        arguments: { query: 'x', mode: 'hybrid', limit: 1 },
      });
      const sc = (res as any).structuredContent;
      expect(sc?.error?.code).toBe('NOT_IMPLEMENTED');
      expect(sc?.error?.tool).toBe('search');
    } finally {
      await close();
    }
  });

  it('returns INVALID_ARGUMENTS for per-tool strict input shapes (spot checks)', async () => {
    const { client, close } = await createIntegrationClient({ envSource: createHermeticEnvSource() });
    try {
      const cases: Array<{ name: string; args: any }> = [
        { name: 'kb_status', args: { extra: 1 } },
        { name: 'describe', args: { entityKey: '' } },
        { name: 'relations', args: { entityKey: 'x', limit: 0 } },
        { name: 'chunk_get', args: { chunkId: 0 } },
        { name: 'edge_evidence_list', args: { edgeId: -1 } },
        { name: 'ingest_runs_list', args: { limit: 0 } },
        { name: 'ingest_run_get', args: { runId: 'nope' } },
      ];

      for (const c of cases) {
        const res = await client.callTool({ name: c.name, arguments: c.args });
        const sc = (res as any).structuredContent;
        expect(sc?.error?.code).toBe('INVALID_ARGUMENTS');
        expect(sc?.error?.tool).toBe(c.name);
      }
    } finally {
      await close();
    }
  });
});
