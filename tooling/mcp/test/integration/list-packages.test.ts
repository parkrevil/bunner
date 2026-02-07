import { describe, expect, it } from 'bun:test';

import { createHermeticEnvSource, createIntegrationClient } from './_harness';

describe('mcp/list_packages', () => {
  it('returns KB_SCHEMA_MISSING when DB is unavailable', async () => {
    const { client, close } = await createIntegrationClient({ envSource: createHermeticEnvSource() });
    try {
      const res = await client.callTool({ name: 'list_packages', arguments: {} });
      const sc = (res as any).structuredContent;

      expect(sc?.error?.code).toBe('KB_SCHEMA_MISSING');
      expect(sc?.error?.tool).toBe('list_packages');
      expect(typeof sc?.error?.hint).toBe('string');
    } finally {
      await close();
    }
  });

  it('returns KB_CONFIG_INVALID when env is missing', async () => {
    const { client, close } = await createIntegrationClient({ envSource: {} });
    try {
      const res = await client.callTool({ name: 'list_packages', arguments: {} });
      const sc = (res as any).structuredContent;

      expect(sc?.error?.code).toBe('KB_CONFIG_INVALID');
      expect(sc?.error?.tool).toBe('list_packages');
      expect(Array.isArray(sc?.error?.issues)).toBe(true);
    } finally {
      await close();
    }
  });

  it('returns INVALID_ARGUMENTS before reading env', async () => {
    const { client, close } = await createIntegrationClient({ envSource: {} });
    try {
      const res = await client.callTool({ name: 'list_packages', arguments: { extra: 1 } });
      const sc = (res as any).structuredContent;

      expect(sc?.error?.code).toBe('INVALID_ARGUMENTS');
      expect(sc?.error?.tool).toBe('list_packages');
    } finally {
      await close();
    }
  });
});
