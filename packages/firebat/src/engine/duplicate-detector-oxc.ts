import type { Node } from 'oxc-parser';

import type { DuplicateGroup, DuplicateItem } from '../types';
import type { ParsedFile } from './types';

import { getNodeType } from './oxc-ast-utils';
import { collectDuplicateGroups } from './duplicate-collector';
import { createOxcFingerprint } from './oxc-fingerprint';

const isDuplicateTarget = (node: Node): boolean => {
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

export const detectDuplicatesOxc = (files: ParsedFile[], minSize: number): DuplicateGroup[] => {
  return collectDuplicateGroups(files, minSize, isDuplicateTarget, createOxcFingerprint, getItemKind);
};
