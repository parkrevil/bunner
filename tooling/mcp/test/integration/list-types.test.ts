import { describe, expect, it } from 'bun:test';

import { createHermeticEnvSource, createIntegrationClient } from './_harness';

describe('mcp/list_*_types', () => {
  it('returns KB_SCHEMA_MISSING when DB is unavailable', async () => {
    const { client, close } = await createIntegrationClient({ envSource: createHermeticEnvSource() });
    try {
      for (const name of [
        'list_entity_types',
        'list_chunk_types',
        'list_edge_types',
        'list_strength_types',
      ]) {
        const res = await client.callTool({ name, arguments: {} });
        const sc = (res as any).structuredContent;

        expect(sc?.error?.code).toBe('KB_SCHEMA_MISSING');
        expect(sc?.error?.tool).toBe(name);
      }
    } finally {
      await close();
    }
  });

  it('returns INVALID_ARGUMENTS before reading env', async () => {
    const { client, close } = await createIntegrationClient({ envSource: {} });
    try {
      const res = await client.callTool({ name: 'list_entity_types', arguments: { extra: 1 } as any });
      const sc = (res as any).structuredContent;
      expect(sc?.error?.code).toBe('INVALID_ARGUMENTS');
      expect(sc?.error?.tool).toBe('list_entity_types');
    } finally {
      await close();
    }
  });

  it('returns KB_CONFIG_INVALID when env is missing (valid args)', async () => {
    const { client, close } = await createIntegrationClient({ envSource: {} });
    try {
      const res = await client.callTool({ name: 'list_entity_types', arguments: {} });
      const sc = (res as any).structuredContent;
      expect(sc?.error?.code).toBe('KB_CONFIG_INVALID');
      expect(sc?.error?.tool).toBe('list_entity_types');
    } finally {
      await close();
    }
  });
});
