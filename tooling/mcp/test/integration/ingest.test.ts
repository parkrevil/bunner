import { describe, expect, it } from 'bun:test';

import { createIntegrationClient } from './_harness';

describe('mcp/ingest (contract only)', () => {
  it('returns INVALID_ARGUMENTS for invalid enum values', async () => {
    const { client, close } = await createIntegrationClient({ envSource: {} });
    try {
      const res = await client.callTool({ name: 'ingest', arguments: { only: 'nope' } as any });
      const sc = (res as any).structuredContent;
      expect(sc?.error?.code).toBe('INVALID_ARGUMENTS');
      expect(sc?.error?.tool).toBe('ingest');
    } finally {
      await close();
    }
  });

  it('returns INVALID_ARGUMENTS for additionalProperties before reading env', async () => {
    const { client, close } = await createIntegrationClient({ envSource: {} });
    try {
      const res = await client.callTool({ name: 'ingest', arguments: { extra: 1 } as any });
      const sc = (res as any).structuredContent;
      expect(sc?.error?.code).toBe('INVALID_ARGUMENTS');
      expect(sc?.error?.tool).toBe('ingest');
    } finally {
      await close();
    }
  });

  it('returns KB_CONFIG_INVALID when env is missing (valid args)', async () => {
    const { client, close } = await createIntegrationClient({ envSource: {} });
    try {
      const res = await client.callTool({ name: 'ingest', arguments: { dryRun: true, only: 'all' } });
      const sc = (res as any).structuredContent;

      expect(sc?.error?.code).toBe('KB_CONFIG_INVALID');
      expect(sc?.error?.tool).toBe('ingest');
      expect(Array.isArray(sc?.error?.issues)).toBe(true);
    } finally {
      await close();
    }
  });
});
