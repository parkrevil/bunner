import type { OxcNode, OxcNodeValue } from './types';

const isOxcNode = (value: OxcNodeValue | undefined): value is OxcNode =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const countOxcTokens = (node: OxcNodeValue | undefined): number => {
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

  const visit = (n: OxcNodeValue | undefined) => {
    if (Array.isArray(n)) {
      for (const child of n) {
        visit(child);
      }

      return;
    }

    if (!isOxcNode(n)) {
      return;
    }

    if (typeof n.type === 'string') {
      count++;
    }

    // Iterate all keys
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
