import type { Node } from 'oxc-parser';

import type { NodeRecord, NodeValue, ParsedFile } from './types';

import { countOxcTokens } from './oxc-token-count';

const isOxcNode = (value: NodeValue): value is Node => typeof value === 'object' && value !== null && !Array.isArray(value);

const isOxcNodeArray = (value: NodeValue): value is ReadonlyArray<Node> => Array.isArray(value);

const isNodeRecord = (node: Node): node is NodeRecord => typeof node === 'object' && node !== null;

const isDuplicationTarget = (node: Node): boolean => {
  const nodeType = node.type;

  return (
    nodeType === 'FunctionDeclaration' ||
    nodeType === 'ClassDeclaration' ||
    nodeType === 'MethodDefinition' ||
    nodeType === 'FunctionExpression' ||
    nodeType === 'ArrowFunctionExpression' ||
    nodeType === 'BlockStatement'
  );
};

const collectDuplicationTargets = (program: NodeValue): Node[] => {
  const targets: Node[] = [];

  const visit = (node: NodeValue): void => {
    if (isOxcNodeArray(node)) {
      for (const child of node) {
        visit(child);
      }

      return;
    }

    if (!isOxcNode(node)) {
      return;
    }

    if (isDuplicationTarget(node)) {
      targets.push(node);
    }

    if (!isNodeRecord(node)) {
      return;
    }

    const entries = Object.entries(node);

    for (const [key, value] of entries) {
      if (key === 'type' || key === 'loc' || key === 'start' || key === 'end') {
        continue;
      }

      visit(value);
    }
  };

  visit(program);

  return targets;
};

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

export const computeAutoMinTokens = (files: ReadonlyArray<ParsedFile>): number => {
  const counts: number[] = [];

  for (const file of files) {
    if (file.errors.length > 0) {
      continue;
    }

    const targets = collectDuplicationTargets(file.program);

    for (const node of targets) {
      counts.push(countOxcTokens(node));
    }
  }

  if (counts.length === 0) {
    return 60;
  }

  counts.sort((a, b) => a - b);

  // Heuristic: choose a high-ish percentile so short boilerplate doesn't dominate.
  // Deterministic and fast: single pass over ASTs + a sort.
  const percentile = 0.75;
  const index = Math.floor((counts.length - 1) * percentile);
  const selected = counts[index] ?? 60;

  return clamp(Math.round(selected), 20, 200);
};
