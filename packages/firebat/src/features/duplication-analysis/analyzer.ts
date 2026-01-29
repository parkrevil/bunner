import type { Node } from 'oxc-parser';

import type { NodeRecord, NodeValue, ParsedFile } from '../../engine/types';
import type { DuplicateGroup, DuplicateItem, DuplicationAnalysis } from '../../types';

import { createOxcFingerprintShape } from '../../engine/oxc-fingerprint';
import { countOxcTokens } from '../../engine/oxc-token-count';
import { getLineColumn } from '../../engine/source-position';

const createEmptyDuplication = (): DuplicationAnalysis => ({
  cloneClasses: [],
});

const isOxcNode = (value: NodeValue): value is Node => typeof value === 'object' && value !== null && !Array.isArray(value);

const isOxcNodeArray = (value: NodeValue): value is ReadonlyArray<Node> => Array.isArray(value);

const isNodeRecord = (node: Node): node is NodeRecord => typeof node === 'object' && node !== null;

const getNodeType = (node: Node): string => node.type;

const getNodeName = (node: NodeValue): string | null => {
  if (!isOxcNode(node)) {
    return null;
  }

  if ('name' in node && typeof node.name === 'string') {
    return node.name;
  }

  return null;
};

const getLiteralString = (node: NodeValue): string | null => {
  if (!isOxcNode(node)) {
    return null;
  }

  if (node.type !== 'Literal') {
    return null;
  }

  if ('value' in node && typeof node.value === 'string') {
    return node.value;
  }

  return null;
};

const isDuplicationTarget = (node: Node): boolean => {
  const nodeType = getNodeType(node);

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

const getNodeHeader = (node: Node): string => {
  const idNode = isNodeRecord(node) ? node.id : undefined;
  const idName = getNodeName(idNode);

  if (typeof idName === 'string' && idName.length > 0) {
    return idName;
  }

  const key = isNodeRecord(node) ? node.key : undefined;

  if (key !== undefined && key !== null) {
    const keyName = getNodeName(key);

    if (typeof keyName === 'string' && keyName.length > 0) {
      return keyName;
    }

    const keyValue = getLiteralString(key);

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

  if (nodeType === 'ClassDeclaration' || nodeType === 'ClassExpression') {
    return 'type';
  }

  return 'node';
};

const detectStructuralDuplicates = (files: ReadonlyArray<ParsedFile>, minTokens: number): DuplicateGroup[] => {
  const groupsByHash = new Map<string, DuplicateItem[]>();

  for (const file of files) {
    if (file.errors.length > 0) {
      continue;
    }

    const targets = collectDuplicationTargets(file.program);

    for (const node of targets) {
      const tokens = countOxcTokens(node);

      if (tokens < minTokens) {
        continue;
      }

      const fingerprint = createOxcFingerprintShape(node);
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

  const groups: DuplicateGroup[] = [];

  for (const [fingerprint, items] of groupsByHash.entries()) {
    if (items.length < 2) {
      continue;
    }

    groups.push({
      fingerprint,
      items,
    });
  }

  return groups.sort((left, right) => right.items.length - left.items.length);
};

const analyzeDuplication = (files: ReadonlyArray<ParsedFile>, minTokens: number): DuplicationAnalysis => {
  if (files.length === 0) {
    return createEmptyDuplication();
  }

  return {
    cloneClasses: detectStructuralDuplicates(files, minTokens),
  };
};

export { analyzeDuplication, createEmptyDuplication };
