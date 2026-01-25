import { describe, expect, it } from 'bun:test';

import { OxcCFGBuilder } from './cfg-builder';
import { parseSource } from './oxc-wrapper';

const getFirstFunction = (sourceText: string): unknown => {
  const parsed = parseSource('/virtual/cfg-builder.spec.ts', sourceText);
  const program = parsed.program;

  if (!program || typeof program !== 'object') {
    throw new Error('Expected program object');
  }

  const body = (program as Record<string, unknown>)['body'];

  if (!Array.isArray(body) || body.length === 0) {
    throw new Error('Expected program body array');
  }

  return body[0];
};

describe('OxcCFGBuilder', () => {
  it('routes return inside try-finally through the finalizer before exiting', () => {
    const fn = getFirstFunction(
      ['function f() {', '  let value = 1;', '  try {', '    return 0;', '  } finally {', '    value;', '  }', '}'].join('\n'),
    );

    if (!fn || typeof fn !== 'object') {
      throw new Error('Expected function node');
    }

    const bodyNode = (fn as Record<string, unknown>)['body'];
    const builder = new OxcCFGBuilder();
    const built = builder.buildFunctionBody(bodyNode);
    const edges = built.cfg.getEdges();
    const exitId = built.exitId;
    // Find a node that looks like the `return 0` argument payload (Literal).
    let returnLiteralNodeId: number | null = null;

    for (let nodeId = 0; nodeId < built.nodePayloads.length; nodeId += 1) {
      const payload = built.nodePayloads[nodeId];

      if (!payload || typeof payload !== 'object') {
        continue;
      }

      const payloadType = (payload as Record<string, unknown>)['type'];
      const payloadValue = (payload as Record<string, unknown>)['value'];

      if (payloadType === 'Literal' && payloadValue === 0) {
        returnLiteralNodeId = nodeId;

        break;
      }
    }

    expect(returnLiteralNodeId).not.toBeNull();

    // Assert there is no direct edge from the return argument node to exit.
    let hasDirectEdgeToExit = false;

    for (let index = 0; index < edges.length; index += 3) {
      const from = edges[index]!;
      const to = edges[index + 1]!;

      if (from === returnLiteralNodeId && to === exitId) {
        hasDirectEdgeToExit = true;

        break;
      }
    }

    expect(hasDirectEdgeToExit).toBe(false);
  });

  it('supports labeled breaks by preserving a path to code after the labeled loop', () => {
    const fn = getFirstFunction(
      [
        'function f() {',
        '  let value = 0;',
        '  outer: for (let index = 0; index < 1; index += 1) {',
        '    while (true) {',
        '      value = 1;',
        '      break outer;',
        '    }',
        '  }',
        '  return value;',
        '}',
      ].join('\n'),
    );

    if (!fn || typeof fn !== 'object') {
      throw new Error('Expected function node');
    }

    const bodyNode = (fn as Record<string, unknown>)['body'];
    const builder = new OxcCFGBuilder();
    const built = builder.buildFunctionBody(bodyNode);
    // Find a node payload that looks like `return value` argument payload (Identifier named value).
    let returnValueNodeId: number | null = null;

    for (let nodeId = 0; nodeId < built.nodePayloads.length; nodeId += 1) {
      const payload = built.nodePayloads[nodeId];

      if (!payload || typeof payload !== 'object') {
        continue;
      }

      const payloadType = (payload as Record<string, unknown>)['type'];
      const payloadName = (payload as Record<string, unknown>)['name'];

      if (payloadType === 'Identifier' && payloadName === 'value') {
        returnValueNodeId = nodeId;

        break;
      }
    }

    expect(returnValueNodeId).not.toBeNull();

    // Basic reachability from entry node (0) to return value node.
    const edges = built.cfg.getEdges();
    const adjacency: number[][] = Array.from({ length: built.cfg.nodeCount }, () => []);

    for (let index = 0; index < edges.length; index += 3) {
      const from = edges[index]!;
      const to = edges[index + 1]!;
      const bucket = adjacency[from];

      if (bucket) {
        bucket.push(to);
      }
    }

    const visited = new Set<number>();
    const queue: number[] = [built.entryId];

    while (queue.length > 0) {
      const current = queue.shift();

      if (typeof current !== 'number') {
        continue;
      }

      if (visited.has(current)) {
        continue;
      }

      visited.add(current);

      const neighbors = adjacency[current] ?? [];

      for (const next of neighbors) {
        if (!visited.has(next)) {
          queue.push(next);
        }
      }
    }

    expect(visited.has(returnValueNodeId!)).toBe(true);
  });
});
