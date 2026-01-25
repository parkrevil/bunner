import type { Statement, Expression, FunctionBody, Declaration } from 'oxc-parser';

import { hashString } from './hasher';

// Oxc AST structure needs normalization for fingerprinting.
// We traverse the AST and build a string representation of semantics.
// Ignore names, locations, comments.
// Focus on structure: types, operators, literals (optional, maybe normalized).

export const createOxcFingerprint = (node: Statement | Expression | FunctionBody | Declaration): string => {
  const diffs: string[] = [];

  const visit = (n: any) => {
    if (n == null) {
      return;
    }

    if (typeof n !== 'object') {
      diffs.push(`${typeof n}:${String(n)}`);

      return;
    }

    if (Array.isArray(n)) {
      for (const child of n) {
        visit(child);
      }

      return;
    }

    // push Type
    if (n.type) {
      diffs.push(n.type);
    }

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

    const keys = Object.keys(n).sort(); // Sort keys for deterministic output

    for (const key of keys) {
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

      visit(n[key]);
    }
  };

  visit(node);

  return hashString(diffs.join('|'));
};
