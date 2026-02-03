/* oxlint-disable firebat/no-unknown */

import type { Node } from 'oxc-parser';

import type { SourceSpan } from '../types';
import type { ParsedFile } from './types';

import { getLineColumn } from './source-position';
import { getNodeHeader, isFunctionNode, isNodeRecord, isOxcNode } from './oxc-ast-utils';

type ExtractedSymbolKind = 'function' | 'method' | 'class' | 'type' | 'interface' | 'enum';

interface ExtractedSymbol {
  readonly kind: ExtractedSymbolKind;
  readonly name: string;
  readonly span: SourceSpan;
}

interface NodeWithInit {
  readonly init?: unknown;
}

const getNodeSpan = (node: Node, sourceText: string): SourceSpan => ({
  start: getLineColumn(sourceText, node.start),
  end: getLineColumn(sourceText, node.end),
});

const extractSymbolsOxc = (file: ParsedFile): ReadonlyArray<ExtractedSymbol> => {
  const out: ExtractedSymbol[] = [];
  const { program, sourceText } = file;

  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const entry of value) {
        visit(entry);
      }

      return;
    }

    if (!isOxcNode(value)) {
      return;
    }

    const node = value;

    if (node.type === 'FunctionDeclaration') {
      const name = getNodeHeader(node);

      if (name !== 'anonymous') {
        out.push({ kind: 'function', name, span: getNodeSpan(node, sourceText) });
      }
    }

    if (node.type === 'VariableDeclarator' && isNodeRecord(node)) {
      const init = (node as NodeWithInit).init;

      if (isOxcNode(init) && isFunctionNode(init)) {
        const name = getNodeHeader(node);

        if (name !== 'anonymous') {
          out.push({ kind: 'function', name, span: getNodeSpan(node, sourceText) });
        }
      }
    }

    if (node.type === 'ClassDeclaration' || node.type === 'ClassExpression') {
      const name = getNodeHeader(node);

      if (name !== 'anonymous') {
        out.push({ kind: 'class', name, span: getNodeSpan(node, sourceText) });
      }
    }

    if (node.type === 'MethodDefinition') {
      const name = getNodeHeader(node);

      if (name !== 'anonymous') {
        out.push({ kind: 'method', name, span: getNodeSpan(node, sourceText) });
      }
    }

    if (node.type === 'TSTypeAliasDeclaration') {
      const name = getNodeHeader(node);

      if (name !== 'anonymous') {
        out.push({ kind: 'type', name, span: getNodeSpan(node, sourceText) });
      }
    }

    if (node.type === 'TSInterfaceDeclaration') {
      const name = getNodeHeader(node);

      if (name !== 'anonymous') {
        out.push({ kind: 'interface', name, span: getNodeSpan(node, sourceText) });
      }
    }

    if (node.type === 'TSEnumDeclaration') {
      const name = getNodeHeader(node);

      if (name !== 'anonymous') {
        out.push({ kind: 'enum', name, span: getNodeSpan(node, sourceText) });
      }
    }

    if (!isNodeRecord(node)) {
      return;
    }

    const entries = Object.entries(node);

    for (const [key, childValue] of entries) {
      if (key === 'type' || key === 'loc' || key === 'start' || key === 'end') {
        continue;
      }

      visit(childValue);
    }
  };

  visit(program);

  return out;
};

export { extractSymbolsOxc };
export type { ExtractedSymbol, ExtractedSymbolKind };
