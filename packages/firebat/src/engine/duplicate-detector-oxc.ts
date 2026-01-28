import type { Node } from 'oxc-parser';

import type { DuplicateGroup, DuplicateItem } from '../types';
import type { ParsedFile } from './types';

import { createOxcFingerprint } from './oxc-fingerprint';
import { countOxcTokens } from './oxc-token-count';
import { getLineColumn } from './source-position';

// Types of nodes we check for duplicates
type DuplicateTarget = Node;

const isOxcNode = (value: Node | ReadonlyArray<Node> | undefined): value is Node =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isOxcNodeArray = (value: Node | ReadonlyArray<Node> | undefined): value is ReadonlyArray<Node> => Array.isArray(value);

const getNodeType = (node: Node): string => node.type;

const isDuplicateTarget = (node: Node): node is DuplicateTarget => {
  // Simplified target selection for Oxc AST
  const type = getNodeType(node);

  return (
    type === 'FunctionDeclaration' ||
    type === 'ClassDeclaration' ||
    type === 'MethodDefinition' ||
    type === 'FunctionExpression' ||
    type === 'ArrowFunctionExpression' ||
    type === 'BlockStatement' ||
    type === 'TSTypeAliasDeclaration' ||
    type === 'TSInterfaceDeclaration'
  );
};

const collectDuplicateTargets = (program: Node | ReadonlyArray<Node> | undefined): DuplicateTarget[] => {
  const targets: DuplicateTarget[] = [];

  const visit = (node: Node | ReadonlyArray<Node> | undefined) => {
    if (isOxcNodeArray(node)) {
      for (const child of node) {
        visit(child);
      }

      return;
    }

    if (!isOxcNode(node)) {
      return;
    }

    if (isDuplicateTarget(node)) {
      targets.push(node);
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

const getNodeHeader = (node: Node): string => {
  const idNode = node.id;
  const idName = isOxcNode(idNode) ? (idNode.name as string) : null;

  if (typeof idName === 'string' && idName.length > 0) {
    return idName;
  }

  const key = node.key;

  if (key !== undefined && key !== null) {
    const keyName = isOxcNode(key) ? (key.name as string) : null;

    if (typeof keyName === 'string' && keyName.length > 0) {
      return keyName;
    }

    const keyValue = isOxcNode(key) ? key.value : null;

    if (typeof keyValue === 'string' && keyValue.length > 0) {
      return keyValue;
    }
  }

  return 'anonymous';
};

const getItemKind = (node: Node): DuplicateItem['kind'] => {
  const nodeType = getNodeType(node);

  if (nodeType === 'FunctionDeclaration' || nodeType === 'FunctionExpression' || nodeType === 'ArrowFunctionExpression') {
    return 'function';
  }

  if (nodeType === 'MethodDefinition') {
    return 'method';
  }

  if (nodeType === 'ClassDeclaration' || nodeType === 'ClassExpression' || nodeType === 'TSTypeAliasDeclaration') {
    return 'type';
  }

  if (nodeType === 'TSInterfaceDeclaration') {
    return 'interface';
  }

  return 'node';
};

export const detectDuplicatesOxc = (files: ParsedFile[], minTokens: number): DuplicateGroup[] => {
  const groupsByHash = new Map<string, DuplicateItem[]>();

  for (const file of files) {
    if (file.errors.length > 0) {
      continue;
    } // Skip errored files

    const targets = collectDuplicateTargets(file.program);

    for (const node of targets) {
      const tokens = countOxcTokens(node);

      if (tokens < minTokens) {
        continue;
      }

      const fingerprint = createOxcFingerprint(node);
      const existing = groupsByHash.get(fingerprint) ?? [];
      const startOffset = node.start;
      const endOffset = node.end;
      const start = getLineColumn(file.sourceText, startOffset);
      const end = getLineColumn(file.sourceText, endOffset);

      existing.push({
        kind: getItemKind(node),
        header: getNodeHeader(node),
        filePath: file.filePath,
        span: {
          start,
          end,
        },
        tokens,
      });
      groupsByHash.set(fingerprint, existing);
    }
  }

  // Filter groups with < 2 items and sort
  const groups: DuplicateGroup[] = [];

  for (const [fingerprint, items] of groupsByHash.entries()) {
    if (items.length < 2) {
      continue;
    }

    groups.push({
      fingerprint,
      items: items, // Sort logic if needed
    });
  }

  return groups.sort((a, b) => b.items.length - a.items.length);
};
