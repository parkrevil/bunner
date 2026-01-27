import type { DuplicateGroup, DuplicateItem } from '../types';
import type { OxcNode, OxcNodeValue } from './types';

import { createOxcFingerprint } from './oxc-fingerprint';
import { countOxcTokens } from './oxc-token-count';
import { getLineColumn, type ParsedFile } from './oxc-wrapper';

// Types of nodes we check for duplicates
type DuplicateTarget = OxcNode;

const isOxcNode = (value: OxcNodeValue | undefined): value is OxcNode =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isOxcNodeArray = (value: OxcNodeValue | undefined): value is ReadonlyArray<OxcNodeValue> => Array.isArray(value);

const getNodeType = (node: OxcNode): string | null => {
  return typeof node.type === 'string' ? node.type : null;
};

const isDuplicateTarget = (node: OxcNode): node is DuplicateTarget => {
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

const collectDuplicateTargets = (program: OxcNodeValue | undefined): DuplicateTarget[] => {
  const targets: DuplicateTarget[] = [];

  const visit = (node: OxcNodeValue | undefined) => {
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

const getNodeHeader = (node: OxcNode): string => {
  const idNode = node.id;
  const idName = isOxcNode(idNode) && typeof idNode.name === 'string' ? idNode.name : null;

  if (typeof idName === 'string' && idName.length > 0) {
    return idName;
  }

  const key = node.key;

  if (key !== undefined && key !== null) {
    const keyName = isOxcNode(key) && typeof key.name === 'string' ? key.name : null;

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

const getItemKind = (node: OxcNode): DuplicateItem['kind'] => {
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
      const startOffset = typeof node.start === 'number' ? node.start : 0;
      const endOffset = typeof node.end === 'number' ? node.end : startOffset;
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
