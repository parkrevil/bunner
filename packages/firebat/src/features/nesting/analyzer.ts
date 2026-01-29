import type { Node } from 'oxc-parser';

import type { NodeRecord, NodeValue, ParsedFile } from '../../engine/types';
import type { NestingAnalysis, NestingItem } from '../../types';

import { getLineColumn } from '../../engine/source-position';

const createEmptyNesting = (): NestingAnalysis => ({
  items: [],
});


const isOxcNode = (value: NodeValue): value is Node => typeof value === 'object' && value !== null && !Array.isArray(value);

const isOxcNodeArray = (value: NodeValue): value is ReadonlyArray<NodeValue> => Array.isArray(value);

const isNodeRecord = (node: Node): node is NodeRecord => typeof node === 'object' && node !== null;

const isFunctionNode = (node: Node): boolean => {
  const nodeType = node.type;

  return nodeType === 'FunctionDeclaration' || nodeType === 'FunctionExpression' || nodeType === 'ArrowFunctionExpression';
};

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


const shouldIncreaseDepth = (nodeType: string): boolean => {
  return (
    nodeType === 'IfStatement' ||
    nodeType === 'ForStatement' ||
    nodeType === 'ForInStatement' ||
    nodeType === 'ForOfStatement' ||
    nodeType === 'WhileStatement' ||
    nodeType === 'DoWhileStatement' ||
    nodeType === 'SwitchStatement' ||
    nodeType === 'TryStatement' ||
    nodeType === 'CatchClause' ||
    nodeType === 'WithStatement'
  );
};

const isDecisionPoint = (nodeType: string): boolean => {
  return (
    nodeType === 'IfStatement' ||
    nodeType === 'ForStatement' ||
    nodeType === 'ForInStatement' ||
    nodeType === 'ForOfStatement' ||
    nodeType === 'WhileStatement' ||
    nodeType === 'DoWhileStatement' ||
    nodeType === 'SwitchStatement' ||
    nodeType === 'ConditionalExpression' ||
    nodeType === 'LogicalExpression' ||
    nodeType === 'CatchClause'
  );
};

const collectFunctionNodes = (program: NodeValue): Node[] => {
  const functions: Node[] = [];

  const visit = (node: NodeValue): void => {
    if (isOxcNodeArray(node)) {
      for (const entry of node) {
        visit(entry);
      }

      return;
    }

    if (!isOxcNode(node)) {
      return;
    }

    if (isFunctionNode(node)) {
      functions.push(node);
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

  return functions;
};

const analyzeFunctionNode = (functionNode: Node, filePath: string, sourceText: string): NestingItem | null => {
  if (!isNodeRecord(functionNode)) {
    return null;
  }

  const bodyValue = functionNode.body;

  if (bodyValue === null || bodyValue === undefined) {
    return null;
  }

  let maxDepth = 0;
  let decisionPoints = 0;

  const visit = (node: NodeValue, depth: number): void => {
    if (isOxcNodeArray(node)) {
      for (const entry of node) {
        visit(entry, depth);
      }

      return;
    }

    if (!isOxcNode(node)) {
      return;
    }

    if (node !== functionNode && isFunctionNode(node)) {
      return;
    }

    const nodeType = node.type;
    const nextDepth = shouldIncreaseDepth(nodeType) ? depth + 1 : depth;

    if (nextDepth > maxDepth) {
      maxDepth = nextDepth;
    }

    if (isDecisionPoint(nodeType)) {
      decisionPoints += 1;
    }


    if (!isNodeRecord(node)) {
      return;
    }

    const entries = Object.entries(node);

    for (const [key, value] of entries) {
      if (key === 'type' || key === 'loc' || key === 'start' || key === 'end') {
        continue;
      }

      visit(value, nextDepth);
    }
  };

  visit(bodyValue as NodeValue, 0);

  const start = getLineColumn(sourceText, functionNode.start);
  const end = getLineColumn(sourceText, functionNode.end);
  const header = getNodeHeader(functionNode);
  const nestingScore = Math.max(0, maxDepth * 3 + decisionPoints);
  const nestingSuggestions: string[] = [];

  if (maxDepth >= 3) {
    nestingSuggestions.push('consider guard clauses to reduce nesting');
  }

  if (decisionPoints >= 6) {
    nestingSuggestions.push('consider extracting smaller functions around decision points');
  }

  if (maxDepth >= 4) {
    nestingSuggestions.push('reduce nesting depth to improve readability');
  }

  return {
    filePath,
    header,
    span: {
      start,
      end,
    },
    metrics: {
      depth: maxDepth,
      decisionPoints,
    },
    score: nestingScore,
    suggestions: nestingSuggestions,
  };
};

const collectFunctionItems = (files: ReadonlyArray<ParsedFile>): ReadonlyArray<NestingItem> => {
  const nestingItems: NestingItem[] = [];

  for (const file of files) {
    if (file.errors.length > 0) {
      continue;
    }

    const functions = collectFunctionNodes(file.program);

    for (const functionNode of functions) {
      const result = analyzeFunctionNode(functionNode, file.filePath, file.sourceText);

      if (!result) {
        continue;
      }

      nestingItems.push(result);
    }
  }

  return nestingItems;
};

const analyzeNesting = (files: ReadonlyArray<ParsedFile>): NestingAnalysis => {
  if (files.length === 0) {
    return createEmptyNesting();
  }

  const nestingItems = collectFunctionItems(files);

  return {
    items: nestingItems,
  };
};

export { analyzeNesting, createEmptyNesting };
