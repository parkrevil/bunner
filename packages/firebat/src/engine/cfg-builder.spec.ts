import { describe, expect, it } from 'bun:test';

import { OxcCFGBuilder } from './cfg-builder';
import { parseSource } from './oxc-wrapper';
import type { OxcBuiltFunctionCfg, OxcNode, OxcNodeValue } from './types';

const isOxcNode = (value: OxcNodeValue | undefined): value is OxcNode =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isOxcNodeArray = (value: OxcNodeValue | undefined): value is ReadonlyArray<OxcNodeValue> => Array.isArray(value);

const getFirstFunction = (sourceText: string): OxcNode => {
  const parsed = parseSource('/virtual/cfg-builder.spec.ts', sourceText);
  const program = parsed.program;

  if (!isOxcNode(program)) {
    throw new Error('Expected program node');
  }

  const body = program.body;

  if (!isOxcNodeArray(body) || body.length === 0) {
    throw new Error('Expected program body array');
  }

  const functionNode = body[0];

  if (!isOxcNode(functionNode)) {
    throw new Error('Expected function node');
  }

  return functionNode;
};

const findLiteralNodeId = (built: OxcBuiltFunctionCfg, literalValue: number): number => {
  for (let nodeId = 0; nodeId < built.nodePayloads.length; nodeId += 1) {
    const payload = built.nodePayloads[nodeId];

    if (!isOxcNode(payload)) {
      continue;
    }

    const payloadType = payload.type;
    const payloadValue = payload.value;

    if (payloadType === 'Literal' && payloadValue === literalValue) {
      return nodeId;
    }
  }

  throw new Error('Expected return literal node id');
};

const findIdentifierNodeId = (built: OxcBuiltFunctionCfg, identifier: string): number => {
  for (let nodeId = 0; nodeId < built.nodePayloads.length; nodeId += 1) {
    const payload = built.nodePayloads[nodeId];

    if (!isOxcNode(payload)) {
      continue;
    }

    const payloadType = payload.type;
    const payloadName = payload.name;

    if (payloadType === 'Identifier' && payloadName === identifier) {
      return nodeId;
    }
  }

  throw new Error('Expected return value node id');
};

const hasEdge = (edges: Int32Array, fromNode: number, toNode: number): boolean => {
  for (let index = 0; index < edges.length; index += 3) {
    const from = edges[index];
    const to = edges[index + 1];

    if (from === undefined || to === undefined) {
      continue;
    }

    if (from === fromNode && to === toNode) {
      return true;
    }
  }

  return false;
};

const buildAdjacency = (edges: Int32Array, nodeCount: number): number[][] => {
  const adjacency: number[][] = Array.from({ length: nodeCount }, () => []);

  for (let index = 0; index < edges.length; index += 3) {
    const from = edges[index];
    const to = edges[index + 1];

    if (from === undefined || to === undefined) {
      continue;
    }

    const bucket = adjacency[from];

    if (bucket !== undefined) {
      bucket.push(to);
    }
  }

  return adjacency;
};

const isReachable = (adjacency: number[][], startNode: number, targetNode: number): boolean => {
  const visited = new Set<number>();
  const queue: number[] = [startNode];

  while (queue.length > 0) {
    const current = queue.shift();

    if (current === undefined) {
      continue;
    }

    if (visited.has(current)) {
      continue;
    }

    if (current === targetNode) {
      return true;
    }

    visited.add(current);

    const neighbors = adjacency[current] ?? [];

    for (const next of neighbors) {
      if (!visited.has(next)) {
        queue.push(next);
      }
    }
  }

  return false;
};

describe('cfg-builder', () => {
  it('should route return through the finalizer when exiting a try-finally', () => {
    // Arrange
    const fn = getFirstFunction(
      ['function f() {', '  let value = 1;', '  try {', '    return 0;', '  } finally {', '    value;', '  }', '}'].join('\n'),
    );
    const builder = new OxcCFGBuilder();
    // Act
    const built = builder.buildFunctionBody(fn.body);
    const returnLiteralNodeId = findLiteralNodeId(built, 0);
    const hasDirectEdgeToExit = hasEdge(built.cfg.getEdges(), returnLiteralNodeId, built.exitId);

    // Assert
    expect(hasDirectEdgeToExit).toBe(false);
  });

  it('should preserve a path after the labeled loop when a labeled break is used', () => {
    // Arrange
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
    const builder = new OxcCFGBuilder();
    // Act
    const built = builder.buildFunctionBody(fn.body);
    const returnValueNodeId = findIdentifierNodeId(built, 'value');
    const adjacency = buildAdjacency(built.cfg.getEdges(), built.cfg.nodeCount);
    const reachable = isReachable(adjacency, built.entryId, returnValueNodeId);

    // Assert
    expect(reachable).toBe(true);
  });
});
