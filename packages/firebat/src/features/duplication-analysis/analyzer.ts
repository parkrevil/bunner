import type { Node } from 'oxc-parser';

import type { ParsedFile } from '../../engine/types';
import type { DuplicateGroup, DuplicateItem, DuplicationAnalysis } from '../../types';

import { collectDuplicateGroups } from '../../engine/duplicate-collector';
import { getNodeType } from '../../engine/oxc-ast-utils';
import { createOxcFingerprintShape } from '../../engine/oxc-fingerprint';

const createEmptyDuplication = (): DuplicationAnalysis => ({
  cloneClasses: [],
});

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

const detectStructuralDuplicates = (files: ReadonlyArray<ParsedFile>, minSize: number): DuplicateGroup[] => {
  return collectDuplicateGroups(files, minSize, isDuplicationTarget, createOxcFingerprintShape, getItemKind);
};

const analyzeDuplication = (files: ReadonlyArray<ParsedFile>, minSize: number): DuplicationAnalysis => {
  if (files.length === 0) {
    return createEmptyDuplication();
  }

  return {
    cloneClasses: detectStructuralDuplicates(files, minSize),
  };
};

export { analyzeDuplication, createEmptyDuplication };
