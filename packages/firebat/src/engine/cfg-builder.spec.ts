import { describe, expect, it } from 'bun:test';

import { OxcCFGBuilder } from './cfg-builder';
import { parseSource } from './oxc-wrapper';
import type { OxcNode, OxcNodeValue } from './types';

const isOxcNode = (value: OxcNodeValue | undefined): value is OxcNode =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const getFirstFunction = (sourceText: string): OxcNode => {
  const parsed = parseSource('/virtual/cfg-builder.spec.ts', sourceText);
  const program = parsed.program;

  if (!isOxcNode(program)) {
    throw new Error('Expected program node');
  }

  const body = program.body;

  if (!Array.isArray(body) || body.length === 0) {
    throw new Error('Expected program body array');
  }

  const functionNode = body[0];

  if (!isOxcNode(functionNode)) {
    throw new Error('Expected function node');
  }

  return functionNode;
};

describe('OxcCFGBuilder', () => {
  it('routes return inside try-finally through the finalizer before exiting', () => {
    const fn = getFirstFunction(
      ['function f() {', '  let value = 1;', '  try {', '    return 0;', '  } finally {', '    value;', '  }', '}'].join('\n'),
    );
    const bodyNode = fn.body;
    const builder = new OxcCFGBuilder();
    const built = builder.buildFunctionBody(bodyNode);
    const edges = built.cfg.getEdges();
    const exitId = built.exitId;
    // Find a node that looks like the `return 0` argument payload (Literal).
    let returnLiteralNodeId: number | null = null;

    for (let nodeId = 0; nodeId < built.nodePayloads.length; nodeId += 1) {
      const payload = built.nodePayloads[nodeId];

      if (!isOxcNode(payload)) {
        continue;
      }

      const payloadType = payload.type;
      const payloadValue = payload.value;

      if (payloadType === 'Literal' && payloadValue === 0) {
        returnLiteralNodeId = nodeId;

        break;
      }
    }

    if (returnLiteralNodeId === null) {
      throw new Error('Expected return literal node id');
    }

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
    const bodyNode = fn.body;
    const builder = new OxcCFGBuilder();
    const built = builder.buildFunctionBody(bodyNode);
    // Find a node payload that looks like `return value` argument payload (Identifier named value).
    let returnValueNodeId: number | null = null;

    for (let nodeId = 0; nodeId < built.nodePayloads.length; nodeId += 1) {
      const payload = built.nodePayloads[nodeId];

      if (!isOxcNode(payload)) {
        continue;
      }

      const payloadType = payload.type;
      const payloadName = payload.name;

      if (payloadType === 'Identifier' && payloadName === 'value') {
        returnValueNodeId = nodeId;

        break;
      }
    }

    if (returnValueNodeId === null) {
      throw new Error('Expected return value node id');
    }

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

    expect(visited.has(returnValueNodeId)).toBe(true);
  });
});
