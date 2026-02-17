import { describe, expect, it } from 'bun:test';

import { __testing__ } from './mcp.command';
import type { ResolvedBunnerConfig } from '../config';

const testConfig: ResolvedBunnerConfig = {
  module: { fileName: 'module.ts' },
  sourceDir: './src',
  entry: './src/main.ts',
  mcp: {
    card: { relations: [] },
    exclude: [],
  },
};

describe('createMcpCommand', () => {
  it('should call ensureRepo before loadConfig on serve', async () => {
    // Arrange
    const calls: string[] = [];
    const cmd = __testing__.createMcpCommand({
      ensureRepo: async () => {
        calls.push('ensureRepo');
      },
      loadConfig: async () => {
        calls.push('loadConfig');
        return { config: testConfig };
      },
      verifyProject: async () => ({ ok: true, errors: [], warnings: [] }),
      rebuildProjectIndex: async () => ({ ok: true }),
      startServer: async () => {
        calls.push('startServer');
      },
      reportInvalidSubcommand: () => {
        calls.push('invalid');
      },
    });

    // Act
    await cmd(['serve'], {});

    // Assert
    expect(calls).toEqual(['ensureRepo', 'loadConfig', 'startServer']);
  });

  it('should call ensureRepo before loadConfig on verify', async () => {
    // Arrange
    const calls: string[] = [];
    const cmd = __testing__.createMcpCommand({
      ensureRepo: async () => {
        calls.push('ensureRepo');
      },
      loadConfig: async () => {
        calls.push('loadConfig');
        return { config: testConfig };
      },
      verifyProject: async () => {
        calls.push('verifyProject');
        return { ok: true, errors: [], warnings: [] };
      },
      rebuildProjectIndex: async () => ({ ok: true }),
      startServer: async () => {
        calls.push('startServer');
      },
      reportInvalidSubcommand: () => {
        calls.push('invalid');
      },
    });

    // Act
    await cmd(['verify'], {});

    // Assert
    expect(calls).toEqual(['ensureRepo', 'loadConfig', 'verifyProject']);
  });

  it('should report invalid subcommand when unknown', async () => {
    // Arrange
    const calls: string[] = [];
    const cmd = __testing__.createMcpCommand({
      loadConfig: async () => ({ config: testConfig }),
      ensureRepo: async () => {
        calls.push('ensureRepo');
      },
      verifyProject: async () => ({ ok: true, errors: [], warnings: [] }),
      rebuildProjectIndex: async () => ({ ok: true }),
      startServer: async () => {
        calls.push('startServer');
      },
      reportInvalidSubcommand: (value) => {
        calls.push(`invalid:${value}`);
      },
    });

    // Act
    await cmd(['nope'], {});

    // Assert
    expect(calls).toEqual(['invalid:nope']);
  });

  it('should support rebuild without --full (incremental)', async () => {
    // Arrange
    const calls: Array<{ name: string; mode?: string }> = [];

    const cmd = __testing__.createMcpCommand({
      loadConfig: async () => ({ config: testConfig }),
      ensureRepo: async () => {
        calls.push({ name: 'ensureRepo' });
      },
      verifyProject: async () => ({ ok: true, errors: [], warnings: [] }),
      startServer: async () => {
        calls.push({ name: 'startServer' });
      },
      reportInvalidSubcommand: (value) => {
        calls.push({ name: `invalid:${value}` });
      },
      rebuildProjectIndex: async (input) => {
        calls.push({ name: 'rebuild', mode: input.mode });
        return { ok: true };
      },
    } as any);

    // Act
    await cmd(['rebuild'], {});

    // Assert
    expect(calls).toEqual([
      { name: 'ensureRepo' },
      { name: 'rebuild', mode: 'incremental' },
    ]);
  });

  it('should support rebuild with --full (full)', async () => {
    // Arrange
    const calls: Array<{ name: string; mode?: string }> = [];

    const cmd = __testing__.createMcpCommand({
      loadConfig: async () => ({ config: testConfig }),
      ensureRepo: async () => {
        calls.push({ name: 'ensureRepo' });
      },
      verifyProject: async () => ({ ok: true, errors: [], warnings: [] }),
      startServer: async () => {
        calls.push({ name: 'startServer' });
      },
      reportInvalidSubcommand: (value) => {
        calls.push({ name: `invalid:${value}` });
      },
      rebuildProjectIndex: async (input) => {
        calls.push({ name: 'rebuild', mode: input.mode });
        return { ok: true };
      },
    } as any);

    // Act
    await cmd(['rebuild', '--full'], {});

    // Assert
    expect(calls).toEqual([
      { name: 'ensureRepo' },
      { name: 'rebuild', mode: 'full' },
    ]);
  });

  it('rebuildProjectIndexDefault should emit reindex signal when role is reader', async () => {
    const calls: string[] = [];

    const out = await __testing__.rebuildProjectIndexDefault(
      { projectRoot: '/repo', config: testConfig, mode: 'full' },
      {
        pid: 999,
        nowMs: () => 123,
        createOwnerElection: () => ({
          acquire: () => ({ role: 'reader' as const }),
          release: () => {
            calls.push('release');
          },
        }),
        emitReindexSignal: async (input) => {
          calls.push(`signal:${input.projectRoot}:${input.pid}:${input.nowMs()}`);
          return { signalPath: '/repo/.bunner/cache/reindex.signal' };
        },
        createDb: () => {
          throw new Error('createDb should not be called for reader');
        },
        closeDb: () => {},
        indexProject: async () => {
          throw new Error('indexProject should not be called for reader');
        },
      },
    );

    expect(out).toEqual({ ok: true });
    expect(calls).toEqual(['signal:/repo:999:123', 'release']);
  });
});
