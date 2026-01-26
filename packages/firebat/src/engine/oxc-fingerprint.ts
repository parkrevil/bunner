import { hashString } from './hasher';
import type { OxcNode, OxcNodeValue } from './types';

const isOxcNode = (value: OxcNodeValue | undefined): value is OxcNode =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// Oxc AST structure needs normalization for fingerprinting.
// We traverse the AST and build a string representation of semantics.
// Ignore names, locations, comments.
// Focus on structure: types, operators, literals (optional, maybe normalized).

export const createOxcFingerprint = (node: OxcNodeValue | undefined): string => {
  const diffs: string[] = [];

  const visit = (n: OxcNodeValue | undefined) => {
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

    if (!isOxcNode(n)) {
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

    const entries = (Object.entries(n)).sort((left, right) =>
      left[0].localeCompare(right[0]),
    );

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
