import type { Node } from 'oxc-parser';

import { hashString } from './hasher';

const isOxcNode = (value: Node | ReadonlyArray<Node> | undefined): value is Node =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isOxcNodeArray = (value: Node | ReadonlyArray<Node> | undefined): value is ReadonlyArray<Node> => Array.isArray(value);

const pushLiteralValue = (node: Node, diffs: string[]): void => {
  if (!('value' in node)) {
    return;
  }

  const literalType = node.type;
  const value = (node as { value: unknown }).value;

  if (literalType === 'Literal' || literalType.endsWith('Literal')) {
    if (typeof value === 'string') {
      diffs.push(`string:${value}`);

      return;
    }

    if (typeof value === 'number') {
      diffs.push(`number:${value}`);

      return;
    }

    if (typeof value === 'boolean') {
      diffs.push(`boolean:${value}`);

      return;
    }

    if (typeof value === 'bigint') {
      diffs.push(`bigint:${value.toString()}`);

      return;
    }

    if (value === null) {
      diffs.push('null');
    }
  }
};

// Oxc AST structure needs normalization for fingerprinting.
// We traverse the AST and build a string representation of semantics.
// Ignore names, locations, comments.
// Focus on structure: types, operators, literals (optional, maybe normalized).

export const createOxcFingerprint = (node: Node | ReadonlyArray<Node> | undefined): string => {
  const diffs: string[] = [];

  const visit = (n: Node | ReadonlyArray<Node> | undefined) => {
    if (isOxcNodeArray(n)) {
      for (const child of n) {
        visit(child);
      }

      return;
    }

    if (!isOxcNode(n)) {
      return;
    }

    // push Type
    if (n.type.length > 0) {
      diffs.push(n.type);
    }

    pushLiteralValue(n, diffs);

    // push specific semantic properties
    // e.g. Operator for BinaryExpression
    if (n.operator) {
      diffs.push(n.operator);
    }

    // Recursively visit children
    // Using specific known keys for Oxc nodes to avoid noise would be better,
    // but generic traversal is safer for completeness unless we map *every* node type.
    // For 'Physical Limit', we might want a optimized traverser.
    // Let's stick to generic for now, optimizing later if profiled.

    const entries = Object.entries(n).sort((left, right) => left[0].localeCompare(right[0]));

    for (const [key, value] of entries) {
      if (key === 'type' || key === 'start' || key === 'end' || key === 'loc' || key === 'span' || key === 'comments') {
        continue;
      }

      // Skip identifiers names to allow renaming-robust detection?
      // User said "strict". Usually strict means "exact match".
      // But renaming robust is "Type-2".
      // Let's check original spec: "Strict: 0 FP". Duplicate usually implies structure match.
      // If we include names, it's Type-1. If we exclude, it's Type-2.
      // Let's include names for "Strict" equality initially?
      // No, usually copy-paste detection ignores whitespace (Type-1).
      // Type-2 ignores variable names.
      // Let's ignore Identifier names for better detection but include value literals.
      if (key === 'name' && n.type === 'Identifier') {
        diffs.push('$ID');

        continue;
      }

      visit(value);
    }
  };

  visit(node);

  return hashString(diffs.join('|'));
};
