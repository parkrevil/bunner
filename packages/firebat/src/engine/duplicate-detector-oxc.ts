import type { Statement, Declaration, ModuleDeclaration } from 'oxc-parser';

import type { DuplicateGroup, DuplicateItem } from '../types';

import { createOxcFingerprint } from './oxc-fingerprint';
import { countOxcTokens } from './oxc-token-count';
import { getLineColumn, type ParsedFile } from './oxc-wrapper';

// Types of nodes we check for duplicates
type DuplicateTarget = Statement | Declaration | ModuleDeclaration;

const isDuplicateTarget = (node: any): node is DuplicateTarget => {
  // Simplified target selection for Oxc AST
  const type = node.type;

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

const collectDuplicateTargets = (program: any): DuplicateTarget[] => {
  const targets: DuplicateTarget[] = [];

  const visit = (node: any) => {
    if (!node || typeof node !== 'object') {
      return;
    }

    if (isDuplicateTarget(node)) {
      targets.push(node);
    }

    // Arrays
    if (Array.isArray(node)) {
      for (const child of node) {
        visit(child);
      }

      return;
    }

    // Objects
    for (const key in node) {
      if (key === 'type' || key === 'loc') {
        continue;
      }

      visit(node[key]);
    }
  };

  visit(program);

  return targets;
};

const getNodeHeader = (node: any): string => {
  const idName = node?.id?.name;

  if (typeof idName === 'string' && idName.length > 0) {
    return idName;
  }

  const key = node?.key;

  if (key) {
    const keyName = key?.name;

    if (typeof keyName === 'string' && keyName.length > 0) {
      return keyName;
    }

    const keyValue = key?.value;

    if (typeof keyValue === 'string' && keyValue.length > 0) {
      return keyValue;
    }
  }

  return 'anonymous';
};

const getItemKind = (node: any): DuplicateItem['kind'] => {
  switch (node?.type) {
    case 'FunctionDeclaration':
    case 'FunctionExpression':
    case 'ArrowFunctionExpression':
      return 'function';
    case 'MethodDefinition':
      return 'method';
    case 'ClassDeclaration':
    case 'ClassExpression':
      return 'type';
    case 'TSTypeAliasDeclaration':
      return 'type';
    case 'TSInterfaceDeclaration':
      return 'interface';
    default:
      return 'node';
  }
};

export const detectDuplicatesOxc = (files: ParsedFile[], minTokens: number): DuplicateGroup[] => {
  const groupsByHash = new Map<string, DuplicateItem[]>();

  for (const file of files) {
    if (file.errors.length > 0) {
      continue;
    } // Skip errored files

    const targets = collectDuplicateTargets(file.program);

    for (const node of targets) {
      const tokens = countOxcTokens(node as any);

      if (tokens < minTokens) {
        continue;
      }

      const fingerprint = createOxcFingerprint(node as any);
      const existing = groupsByHash.get(fingerprint) ?? [];
      const startOffset = typeof (node as any).start === 'number' ? ((node as any).start as number) : 0;
      const endOffset = typeof (node as any).end === 'number' ? ((node as any).end as number) : startOffset;
      const start = getLineColumn(file.sourceText, startOffset);
      const end = getLineColumn(file.sourceText, endOffset);

      existing.push({
        kind: getItemKind(node as any),
        header: getNodeHeader(node as any),
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
