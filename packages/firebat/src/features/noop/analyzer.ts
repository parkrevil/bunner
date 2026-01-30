import type { Node } from 'oxc-parser';

import type { NodeValue, ParsedFile } from '../../engine/types';
import type { NoopAnalysis, NoopFinding } from '../../types';

import { isNodeRecord, isOxcNode, walkOxcTree } from '../../engine/oxc-ast-utils';
import { getLineColumn } from '../../engine/source-position';

const createEmptyNoop = (): NoopAnalysis => ({
  findings: [],
});

const getSpan = (node: Node, sourceText: string) => {
  const start = getLineColumn(sourceText, node.start);
  const end = getLineColumn(sourceText, node.end);

  return {
    start,
    end,
  };
};

const isNoopExpressionType = (nodeType: string): boolean => {
  return (
    nodeType === 'Literal' ||
    nodeType === 'Identifier' ||
    nodeType === 'ThisExpression' ||
    nodeType === 'ObjectExpression' ||
    nodeType === 'ArrayExpression' ||
    nodeType === 'FunctionExpression' ||
    nodeType === 'ArrowFunctionExpression' ||
    nodeType === 'ClassExpression'
  );
};

const isBooleanLiteral = (value: NodeValue): boolean => {
  if (!isOxcNode(value)) {
    return false;
  }

  if (value.type !== 'Literal') {
    return false;
  }

  return 'value' in value && typeof value.value === 'boolean';
};

const collectNoopFindings = (program: NodeValue, sourceText: string, filePath: string): NoopFinding[] => {
  const findings: NoopFinding[] = [];

  walkOxcTree(program, node => {
    if (node.type === 'ExpressionStatement' && isNodeRecord(node)) {
      const expression = node.expression;

      if (isOxcNode(expression) && isNoopExpressionType(expression.type)) {
        findings.push({
          kind: 'expression-noop',
          filePath,
          span: getSpan(node, sourceText),
          confidence: 0.9,
          evidence: `expression statement has no side effects (${expression.type})`,
        });
      }
    }

    if (node.type === 'IfStatement' && isNodeRecord(node)) {
      const test = node.test;

      if (isBooleanLiteral(test)) {
        findings.push({
          kind: 'constant-condition',
          filePath,
          span: getSpan(node, sourceText),
          confidence: 0.7,
          evidence: 'if condition is a constant boolean literal',
        });
      }
    }

    return true;
  });

  return findings;
};

const analyzeNoop = (files: ReadonlyArray<ParsedFile>): NoopAnalysis => {
  if (files.length === 0) {
    return createEmptyNoop();
  }

  const findings: NoopFinding[] = [];

  for (const file of files) {
    if (file.errors.length > 0) {
      continue;
    }

    findings.push(...collectNoopFindings(file.program, file.sourceText, file.filePath));
  }

  return {
    findings,
  };
};

export { analyzeNoop, createEmptyNoop };
