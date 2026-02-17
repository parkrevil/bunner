import { describe, expect, it } from 'bun:test';

import * as z from 'zod/v3';

import { ToolRegistry, declareTool } from './tool-registry';

describe('ToolRegistry', () => {
  it('should register and list tools in stable name order when multiple tools are added', () => {
    const registry = new ToolRegistry();

    const a = declareTool({
      name: 'a',
      title: 'A',
      description: 'A tool',
      inputSchema: { a: z.string() },
      run: async (_ctx, input) => ({ ok: true, input }),
    });

    const b = declareTool({
      name: 'b',
      title: 'B',
      description: 'B tool',
      inputSchema: { b: z.number() },
      run: async (_ctx, input) => ({ ok: true, input }),
    });

    registry.register(b);
    registry.register(a);

    expect(registry.list().map((t) => t.name)).toEqual(['a', 'b']);
    expect(registry.get('a')?.title).toBe('A');
  });

  it('should throw when registering a duplicate tool name', () => {
    const registry = new ToolRegistry();

    registry.register(
      declareTool({
        name: 'dup',
        title: 'Dup1',
        description: 'dup',
        inputSchema: {},
        run: async () => ({ ok: true }),
      }),
    );

    expect(() =>
      registry.register(
        declareTool({
          name: 'dup',
          title: 'Dup2',
          description: 'dup',
          inputSchema: {},
          run: async () => ({ ok: true }),
        }),
      ),
    ).toThrow('Duplicate tool name');
  });
});
