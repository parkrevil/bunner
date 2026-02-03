/* oxlint-disable typescript-eslint/no-unsafe-assignment, typescript-eslint/no-unsafe-member-access, typescript-eslint/no-unsafe-argument, typescript-eslint/no-unsafe-call, typescript-eslint/no-unsafe-type-assertion, typescript-eslint/strict-boolean-expressions, firebat/no-any, firebat/no-inline-object-type, firebat/no-unknown */

import * as os from 'node:os';
import * as path from 'node:path';

import { expect, test } from 'bun:test';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

type ToolResultLike = {
  readonly structuredContent?: unknown;
  readonly content?: ReadonlyArray<{ readonly text?: string }>;
};

const parseJsonText = (text: string | undefined): unknown => {
  if (text === undefined || text.length === 0) {
    return {};
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return {};
  }
};

const getStructuredContent = (result: ToolResultLike): unknown => {
  if (result.structuredContent !== undefined) {
    return result.structuredContent;
  }

  const first = result.content?.[0];
  const text = first?.text;

  return parseJsonText(text);
};

const getMatches = (value: unknown): ReadonlyArray<{ readonly name?: unknown }> => {
  if (!value || typeof value !== 'object') {
    return [];
  }

  const record = value as { readonly matches?: unknown };

  return Array.isArray(record.matches) ? (record.matches as ReadonlyArray<{ readonly name?: unknown }>) : [];
};

const hasMatchNamed = (value: unknown, expectedName: string): boolean => {
  const matches = getMatches(value);

  for (const match of matches) {
    if (match && typeof match === 'object') {
      const record = match as { readonly name?: unknown };

      if (record.name === expectedName) {
        return true;
      }
    }
  }

  return false;
};

test('should provide symbol index tools when connected via MCP', async () => {
  // Arrange
  const tmpDbPath = path.join(
    os.tmpdir(),
    `firebat-symbol-index-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`,
  );

  process.env.FIREBAT_DB_PATH = tmpDbPath;
  process.env.FIREBAT_CACHE_BUSTER = 'test-symbol-index';

  const client = new Client({ name: 'firebat-symbol-index', version: '0.0.0' });
  const serverEntry = path.resolve(import.meta.dir, '../../../index.ts');
  const transport = new StdioClientTransport({
    command: 'bun',
    args: [serverEntry, 'mcp'],
  });

  // Act
  await client.connect(transport);

  try {
    // Assert
    const tools = await client.listTools();
    const toolNames = new Set(tools.tools.map(t => t.name));

    expect(toolNames.has('index_symbols')).toBe(true);
    expect(toolNames.has('search_symbol_from_index')).toBe(true);
    expect(toolNames.has('get_index_stats_from_index')).toBe(true);
    expect(toolNames.has('clear_index')).toBe(true);
    expect(toolNames.has('get_project_overview')).toBe(true);

    const fixture = path.resolve(import.meta.dir, 'fixtures/symbols.ts');
    const root = path.resolve(import.meta.dir, 'fixtures');

    await client.callTool({ name: 'clear_index', arguments: { root } });

    const indexResult = (await client.callTool({
      name: 'index_symbols',
      arguments: { root, targets: [fixture] },
    })) as ToolResultLike;
    const indexStructured = getStructuredContent(indexResult) as {
      readonly ok?: unknown;
      readonly indexedFiles?: unknown;
      readonly symbolsIndexed?: unknown;
    };

    expect(indexStructured.ok).toBe(true);
    expect(indexStructured.indexedFiles).toBeGreaterThan(0);
    expect(indexStructured.symbolsIndexed).toBeGreaterThan(0);

    const statsResult = (await client.callTool({
      name: 'get_index_stats_from_index',
      arguments: { root },
    })) as ToolResultLike;
    const stats = getStructuredContent(statsResult) as { readonly indexedFileCount?: unknown; readonly symbolCount?: unknown };

    expect(stats.indexedFileCount).toBeGreaterThan(0);
    expect(stats.symbolCount).toBeGreaterThan(0);

    const searchClassResult = (await client.callTool({
      name: 'search_symbol_from_index',
      arguments: { root, query: 'Greeter', limit: 50 },
    })) as ToolResultLike;
    const classStructured = getStructuredContent(searchClassResult);

    expect(hasMatchNamed(classStructured, 'Greeter')).toBe(true);

    const searchMethodResult = (await client.callTool({
      name: 'search_symbol_from_index',
      arguments: { root, query: 'greet', limit: 50 },
    })) as ToolResultLike;
    const methodStructured = getStructuredContent(searchMethodResult);

    expect(hasMatchNamed(methodStructured, 'greet')).toBe(true);

    await client.callTool({ name: 'clear_index', arguments: { root } });

    const statsAfterClearResult = (await client.callTool({
      name: 'get_index_stats_from_index',
      arguments: { root },
    })) as ToolResultLike;
    const statsAfterClear = getStructuredContent(statsAfterClearResult) as {
      readonly indexedFileCount?: unknown;
      readonly symbolCount?: unknown;
    };

    expect(statsAfterClear.indexedFileCount).toBe(0);
    expect(statsAfterClear.symbolCount).toBe(0);
  } finally {
    await client.close();
  }
});
