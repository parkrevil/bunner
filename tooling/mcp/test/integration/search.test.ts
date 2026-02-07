import { describe, expect, it } from 'bun:test';

import { createHermeticEnvSource, createIntegrationClient } from './_harness';

describe('mcp/search', () => {
  it('returns KB_SCHEMA_MISSING when DB is unavailable', async () => {
    const { client, close } = await createIntegrationClient({ envSource: createHermeticEnvSource() });
    try {
      const res = await client.callTool({ name: 'search', arguments: { query: 'test', limit: 1 } });
      const sc = (res as any).structuredContent;

      expect(sc?.error?.code).toBe('KB_SCHEMA_MISSING');
      expect(sc?.error?.tool).toBe('search');
    } finally {
      await close();
    }
  });

  it('returns INVALID_ARGUMENTS for missing query', async () => {
    const { client, close } = await createIntegrationClient({ envSource: {} });
    try {
      const res = await client.callTool({ name: 'search', arguments: { limit: 1 } as any });
      const sc = (res as any).structuredContent;
      expect(sc?.error?.code).toBe('INVALID_ARGUMENTS');
      expect(sc?.error?.tool).toBe('search');
    } finally {
      await close();
    }
  });

  it('returns NOT_IMPLEMENTED for hybrid mode without reading env', async () => {
    const { client, close } = await createIntegrationClient({ envSource: {} });
    try {
      const res = await client.callTool({ name: 'search', arguments: { query: 'x', mode: 'hybrid' } });
      const sc = (res as any).structuredContent;
      expect(sc?.error?.code).toBe('NOT_IMPLEMENTED');
      expect(sc?.error?.tool).toBe('search');
    } finally {
      await close();
    }
  });
});
