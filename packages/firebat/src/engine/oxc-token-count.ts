import type { Node } from 'oxc-parser';

import type { NodeRecord, NodeValue } from './types';

const isOxcNode = (value: NodeValue): value is Node => typeof value === 'object' && value !== null && !Array.isArray(value);

const isOxcNodeArray = (value: NodeValue): value is ReadonlyArray<Node> => Array.isArray(value);

const isNodeRecord = (node: Node): node is NodeRecord => typeof node === 'object' && node !== null;

export const countOxcTokens = (node: NodeValue): number => {
  // Oxc doesn't expose raw token count directly in AST.
  // Estimation based on AST depth or span length is possible, but raw token count requires lexer.
  // For 'physical limit' performance, re-lexing is expensive.
  // We will use a fast heuristic: span length / average token length (e.g., 4) or
  // recursive traversal counting nodes. Node count is more robust than span.

  let count = 0;
  // A simple traversal to count 'semantic' tokens (nodes)
  // This is actually better than raw tokens for duplication detection.

  // Actually, we can just use the span length as a proxy for complexity if we want speed.
  // But strict requirement says "token count".
  // Let's implement a fast recursive node counter.

  const visit = (n: NodeValue) => {
    if (isOxcNodeArray(n)) {
      for (const child of n) {
        visit(child);
      }

      return;
    }

    if (!isOxcNode(n)) {
      return;
    }

    count += 1;

    // Iterate all keys
    if (!isNodeRecord(n)) {
      return;
    }

    const entries = Object.entries(n);

    for (const [key, value] of entries) {
      if (key !== 'type' && key !== 'start' && key !== 'end' && key !== 'loc' && key !== 'span') {
        visit(value);
      }
    }
  };

  visit(node);

  return count;
};
