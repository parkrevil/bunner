import { describe, expect, it } from 'bun:test';

import { createHermeticEnvSource, createIntegrationClient } from './_harness';

describe('mcp/ingest_runs_list + ingest_run_get', () => {
  it('returns KB_SCHEMA_MISSING when DB is unavailable', async () => {
    const { client, close } = await createIntegrationClient({ envSource: createHermeticEnvSource() });
    try {
      const res1 = await client.callTool({ name: 'ingest_runs_list', arguments: { limit: 1 } });
      expect((res1 as any).structuredContent?.error?.code).toBe('KB_SCHEMA_MISSING');

      const res2 = await client.callTool({ name: 'ingest_run_get', arguments: { runId: 1 } });
      expect((res2 as any).structuredContent?.error?.code).toBe('KB_SCHEMA_MISSING');
    } finally {
      await close();
    }
  });

  it('returns INVALID_ARGUMENTS for ingest_run_get missing runId', async () => {
    const { client, close } = await createIntegrationClient({ envSource: {} });
    try {
      const res = await client.callTool({ name: 'ingest_run_get', arguments: {} as any });
      const sc = (res as any).structuredContent;
      expect(sc?.error?.code).toBe('INVALID_ARGUMENTS');
      expect(sc?.error?.tool).toBe('ingest_run_get');
    } finally {
      await close();
    }
  });

  it('returns KB_CONFIG_INVALID when env is missing (valid args)', async () => {
    const { client, close } = await createIntegrationClient({ envSource: {} });
    try {
      const res = await client.callTool({ name: 'ingest_runs_list', arguments: { limit: 1 } });
      const sc = (res as any).structuredContent;
      expect(sc?.error?.code).toBe('KB_CONFIG_INVALID');
      expect(sc?.error?.tool).toBe('ingest_runs_list');
    } finally {
      await close();
    }
  });
});
