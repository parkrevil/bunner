import { describe, expect, it } from 'bun:test';

import { createHermeticEnvSource, createIntegrationClient } from './_harness';

describe('mcp/chunks_by_entity', () => {
  it('returns KB_SCHEMA_MISSING when DB is unavailable', async () => {
    const { client, close } = await createIntegrationClient({ envSource: createHermeticEnvSource() });
    try {
      const res = await client.callTool({
        name: 'chunks_by_entity',
        arguments: { entityKey: 'x', limit: 1, includePayloadJson: false },
      });
      const sc = (res as any).structuredContent;

      expect(sc?.error?.code).toBe('KB_SCHEMA_MISSING');
      expect(sc?.error?.tool).toBe('chunks_by_entity');
    } finally {
      await close();
    }
  });

  it('returns INVALID_ARGUMENTS for missing entityKey', async () => {
    const { client, close } = await createIntegrationClient({ envSource: {} });
    try {
      const res = await client.callTool({ name: 'chunks_by_entity', arguments: { limit: 1 } as any });
      const sc = (res as any).structuredContent;
      expect(sc?.error?.code).toBe('INVALID_ARGUMENTS');
      expect(sc?.error?.tool).toBe('chunks_by_entity');
    } finally {
      await close();
    }
  });

  it('returns KB_CONFIG_INVALID when env is missing (valid args)', async () => {
    const { client, close } = await createIntegrationClient({ envSource: {} });
    try {
      const res = await client.callTool({ name: 'chunks_by_entity', arguments: { entityKey: 'x', limit: 1 } });
      const sc = (res as any).structuredContent;
      expect(sc?.error?.code).toBe('KB_CONFIG_INVALID');
      expect(sc?.error?.tool).toBe('chunks_by_entity');
    } finally {
      await close();
    }
  });
});
