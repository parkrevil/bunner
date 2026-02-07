import { describe, expect, it } from 'bun:test';

import { createHermeticEnvSource, createIntegrationClient } from './_harness';

describe('mcp/describe', () => {
  it('returns KB_SCHEMA_MISSING when DB is unavailable', async () => {
    const { client, close } = await createIntegrationClient({ envSource: createHermeticEnvSource() });
    try {
      const res = await client.callTool({ name: 'describe', arguments: { entityKey: 'x' } });
      const sc = (res as any).structuredContent;

      expect(sc?.error?.code).toBe('KB_SCHEMA_MISSING');
      expect(sc?.error?.tool).toBe('describe');
    } finally {
      await close();
    }
  });

  it('returns INVALID_ARGUMENTS for missing entityKey', async () => {
    const { client, close } = await createIntegrationClient({ envSource: {} });
    try {
      const res = await client.callTool({ name: 'describe', arguments: {} as any });
      const sc = (res as any).structuredContent;
      expect(sc?.error?.code).toBe('INVALID_ARGUMENTS');
      expect(sc?.error?.tool).toBe('describe');
    } finally {
      await close();
    }
  });

  it('returns KB_CONFIG_INVALID when env is missing (valid args)', async () => {
    const { client, close } = await createIntegrationClient({ envSource: {} });
    try {
      const res = await client.callTool({ name: 'describe', arguments: { entityKey: 'x' } });
      const sc = (res as any).structuredContent;
      expect(sc?.error?.code).toBe('KB_CONFIG_INVALID');
      expect(sc?.error?.tool).toBe('describe');
    } finally {
      await close();
    }
  });
});
