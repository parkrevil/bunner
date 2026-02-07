import { describe, expect, it } from 'bun:test';

import { createHermeticEnvSource, createIntegrationClient } from './_harness';

describe('mcp/kb_status', () => {
  it('returns diagnostics even when DB is unavailable', async () => {
    const { client, close } = await createIntegrationClient({ envSource: createHermeticEnvSource() });
    try {
      const res = await client.callTool({ name: 'kb_status', arguments: {} });

      const sc = (res as any).structuredContent;
      expect(sc).toBeDefined();

      expect(sc.schema).toBeDefined();
      expect(sc.schema.ok).toBe(false);

      expect(sc.db).toBeDefined();
      expect(sc.db.primary).toBeDefined();
      expect(typeof sc.db.primary.host).toBe('string');
      expect(typeof sc.db.primary.port).toBe('string');

      expect(sc.connectivity).toBeDefined();
      expect(sc.connectivity.primary).toBeDefined();
      expect(sc.connectivity.primary.ok).toBe(false);

      expect(Array.isArray(sc.connectivity.replicas)).toBe(true);
      expect(sc.connectivity.replicas.length).toBe(2);
      for (const r of sc.connectivity.replicas) {
        expect(r).toBeDefined();
        expect(r.target).toBeDefined();
        expect(typeof r.target.host).toBe('string');
        expect(typeof r.target.port).toBe('string');
        expect(typeof r.ok).toBe('boolean');
      }

      const text = (res as any).content?.[0]?.text;
      expect(typeof text).toBe('string');
      expect(text).toContain('schema');
    } finally {
      await close();
    }
  });

  it('returns KB_CONFIG_INVALID when env is missing', async () => {
    const { client, close } = await createIntegrationClient({ envSource: {} });
    try {
      const res = await client.callTool({ name: 'kb_status', arguments: {} });
      const sc = (res as any).structuredContent;

      expect(sc?.error?.code).toBe('KB_CONFIG_INVALID');
      expect(sc?.error?.tool).toBe('kb_status');
    } finally {
      await close();
    }
  });
});
