import type { Node } from 'oxc-parser';

import type { VariableCollectorOptions, VariableUsage } from './types';

const isOxcNode = (value: Node | ReadonlyArray<Node> | undefined): value is Node =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const getNodeType = (node: Node): string => node.type;

const isOxcNodeArray = (value: Node | ReadonlyArray<Node> | undefined): value is ReadonlyArray<Node> => Array.isArray(value);

const getNodeName = (node: Node): string => node.name as string;

const getNodeStart = (node: Node): number => node.start;

const isFunctionNode = (node: Node | ReadonlyArray<Node> | undefined): boolean => {
  if (!isOxcNode(node)) {
    return false;
  }

  const nodeType = getNodeType(node);

  return nodeType === 'ArrowFunctionExpression' || nodeType === 'FunctionDeclaration' || nodeType === 'FunctionExpression';
};

const unwrapExpression = (node: Node | ReadonlyArray<Node> | undefined): Node | null => {
  let current = isOxcNode(node) ? node : null;

  while (current !== null) {
    const nodeType = getNodeType(current);

    if (nodeType === 'ParenthesizedExpression') {
      const expression = current.expression;

      current = isOxcNode(expression) ? expression : null;

      continue;
    }

    if (nodeType === 'ChainExpression') {
      const expression = current.expression;

      current = isOxcNode(expression) ? expression : null;

      continue;
    }

    break;
  }

  return current;
};

const evalStaticTruthiness = (node: Node | ReadonlyArray<Node> | undefined): boolean | null => {
  const n = unwrapExpression(node);

  if (n === null) {
    return null;
  }

  if (getNodeType(n) === 'Literal') {
    const value = n.value;

    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'number') {
      return value !== 0;
    }

    if (typeof value === 'bigint') {
      return value !== 0n;
    }

    if (typeof value === 'string') {
      return value.length > 0;
    }

    if (value === null) {
      return false;
    }

    return null;
  }

  if (getNodeType(n) === 'UnaryExpression') {
    const operator = typeof n.operator === 'string' ? n.operator : '';
    const argument = n.argument;

    if (operator === 'void') {
      return false;
    }

    if (operator === '!') {
      const inner = evalStaticTruthiness(argument);

      return inner === null ? null : !inner;
    }
  }

  return null;
};

const getStaticObjectExpressionKeys = (node: Node | ReadonlyArray<Node> | undefined): Set<string> | null => {
  const n = unwrapExpression(node);

  if (n === null || getNodeType(n) !== 'ObjectExpression') {
    return null;
  }

  const keys = new Set<string>();
  const properties = (n.properties ?? []) as ReadonlyArray<Node>;

  for (const prop of properties) {
    if (!isOxcNode(prop)) {
      continue;
    }

    if (getNodeType(prop) !== 'Property') {
      continue;
    }

    const key = prop.key;

    if (isOxcNode(key) && getNodeType(key) === 'Identifier') {
      const name = getNodeName(key);

      if (name !== null) {
        keys.add(name);
      }

      continue;
    }

    if (isOxcNode(key) && getNodeType(key) === 'Literal') {
      const value = key.value;

      if (typeof value === 'string') {
        keys.add(value);
      }

      continue;
    }
  }

  return keys;
};

export const collectVariables = (node: Node | ReadonlyArray<Node> | undefined, options: VariableCollectorOptions = {}): VariableUsage[] => {
  const usages: VariableUsage[] = [];
  const includeNestedFunctions = options.includeNestedFunctions !== false;

  const visit = (
    current: Node | ReadonlyArray<Node> | undefined,
    isWriteContext: boolean = false,
    allowNestedFunctions: boolean = includeNestedFunctions,
    writeKind?: VariableUsage['writeKind'],
  ) => {
    if (isOxcNodeArray(current)) {
      for (const item of current) {
        visit(item, isWriteContext, allowNestedFunctions);
      }

      return;
    }

    if (!isOxcNode(current)) {
      return;
    }

    const nodeType = getNodeType(current);

    if (!allowNestedFunctions && isFunctionNode(current)) {
      return;
    }

    // Oxc Node Types
    // Observed in our environment: identifiers are represented as `Identifier`.
    if (nodeType === 'Identifier') {
      const name = getNodeName(current);

      const usage: VariableUsage = {
        name,
        isRead: !isWriteContext,
        isWrite: isWriteContext,
        location: getNodeStart(current),
      };

      if (isWriteContext && writeKind) {
        usage.writeKind = writeKind;
      }

      usages.push(usage);

      return;
    }

    if (nodeType === 'IdentifierReference') {
      const name = getNodeName(current);

      // Usage (Reference)
      usages.push({
        name,
        isRead: !isWriteContext,
        isWrite: isWriteContext,
        location: getNodeStart(current),
      });
    } else if (nodeType === 'BindingIdentifier') {
      const name = getNodeName(current);

      // Declaration
      usages.push({
        name,
        isRead: false,
        isWrite: true,
        location: getNodeStart(current),
        writeKind: 'declaration',
      });
    } else if (nodeType === 'AssignmentTargetIdentifier') {
      const name = getNodeName(current);

      const usage: VariableUsage = {
        name,
        isRead: !isWriteContext,
        isWrite: isWriteContext,
        location: getNodeStart(current),
      };

      if (isWriteContext && writeKind) {
        usage.writeKind = writeKind;
      }

      usages.push(usage);

      return;
    }

    const isMemberExpression = nodeType?.includes('MemberExpression') === true;

    if (isMemberExpression) {
      // `obj.prop` does not read `prop` as a variable; only `obj`.
      // `obj[prop]` reads both `obj` and `prop`.
      const objectNode = current.object;

      if (objectNode !== undefined && objectNode !== null) {
        visit(objectNode, false, allowNestedFunctions);
      }

      const isComputed = current.computed;
      const propertyNode = current.property;

      if (isComputed === true && propertyNode !== undefined && propertyNode !== null) {
        visit(propertyNode, false, allowNestedFunctions);
      }

      const expressionNode = current.expression;

      if (expressionNode !== undefined && expressionNode !== null) {
        visit(expressionNode, false, allowNestedFunctions);
      }

      return;
    }

    // Handle constructions
    if (nodeType === 'LogicalExpression') {
      const operator = typeof current.operator === 'string' ? current.operator : '';
      const left = current.left;
      const right = current.right;

      // Left is always evaluated.
      visit(left, false, allowNestedFunctions);

      const leftTruthiness = evalStaticTruthiness(left);

      if (operator === '&&') {
        if (leftTruthiness === false) {
          return;
        }

        visit(right, false, allowNestedFunctions);

        return;
      }

      if (operator === '||') {
        if (leftTruthiness === true) {
          return;
        }

        visit(right, false, allowNestedFunctions);

        return;
      }

      // For unknown operators or unknown truthiness, be conservative.
      visit(right, false, allowNestedFunctions);

      return;
    }

    if (nodeType === 'ConditionalExpression') {
      const test = current.test;
      const consequent = current.consequent;
      const alternate = current.alternate;

      // Test is always evaluated.
      visit(test, false, allowNestedFunctions);

      const truthiness = evalStaticTruthiness(test);

      if (truthiness === true) {
        visit(consequent, false, allowNestedFunctions);

        return;
      }

      if (truthiness === false) {
        visit(alternate, false, allowNestedFunctions);

        return;
      }

      // Unknown: either branch may execute.
      visit(consequent, false, allowNestedFunctions);
      visit(alternate, false, allowNestedFunctions);

      return;
    }

    if (nodeType === 'AssignmentExpression') {
      const operator = typeof current.operator === 'string' ? current.operator : '=';
      const left = current.left;
      const right = current.right;

      if (operator === '=') {
        visit(left, true, allowNestedFunctions, 'assignment'); // LHS is write
        visit(right, false, allowNestedFunctions); // RHS is read

        return;
      }

      if (operator === '||=' || operator === '&&=' || operator === '??=') {
        visit(left, false, allowNestedFunctions);
        visit(left, true, allowNestedFunctions, 'logical-assignment');
        visit(right, false, allowNestedFunctions);

        return;
      }

      // Compound assignment (+=, -=, ...)
      visit(left, false, allowNestedFunctions); // reads LHS
      visit(left, true, allowNestedFunctions, 'compound-assignment'); // writes LHS
      visit(right, false, allowNestedFunctions); // RHS is read

      return;
    }

    if (nodeType === 'UpdateExpression') {
      const argument = current.argument;

      // Treat update as both read and write.
      visit(argument, false, allowNestedFunctions);
      visit(argument, true, allowNestedFunctions, 'update');

      return;
    }

    if (nodeType === 'VariableDeclarator') {
      const init = current.init;
      const id = current.id;
      const initKeys = getStaticObjectExpressionKeys(init);
      const idNode = isOxcNode(id) ? id : null;

      if (idNode !== null && getNodeType(idNode) === 'ObjectPattern' && initKeys !== null) {
        // Object destructuring defaults are only evaluated if the property is missing.
        const properties = isOxcNodeArray(idNode.properties) ? idNode.properties : [];

        for (const prop of properties) {
          if (!isOxcNode(prop)) {
            continue;
          }

          if (getNodeType(prop) !== 'Property') {
            continue;
          }

          const keyNode = prop.key;
          let keyName: string | null = null;

          if (isOxcNode(keyNode)) {
            const keyType = getNodeType(keyNode);

            if (keyType === 'Identifier') {
              const name = getNodeName(keyNode);

              keyName = name;
            } else if (keyType === 'Literal') {
              const value = keyNode.value;

              if (typeof value === 'string') {
                keyName = value;
              }
            }
          }

          const valueNode = prop.value;

          if (isOxcNode(valueNode) && getNodeType(valueNode) === 'AssignmentPattern') {
            const leftNode = valueNode.left;
            const rightNode = valueNode.right;

            visit(leftNode, true, allowNestedFunctions, 'declaration');

            const shouldEvaluateDefault = keyName === null ? true : !initKeys.has(keyName);

            if (shouldEvaluateDefault) {
              visit(rightNode, false, allowNestedFunctions);
            }

            continue;
          }

          visit(valueNode, true, allowNestedFunctions, 'declaration');
        }
      } else {
        visit(id, true, allowNestedFunctions, 'declaration'); // Def
      }

      if (init !== undefined && init !== null) {
        visit(init, false, allowNestedFunctions);
      } // Use

      return;
    }

    if (nodeType === 'CallExpression') {
      const callee = current.callee;
      const args = isOxcNodeArray(current.arguments) ? current.arguments : [];
      const unwrappedCallee = unwrapExpression(callee);

      if (unwrappedCallee !== null && isFunctionNode(unwrappedCallee)) {
        visit(unwrappedCallee, false, true);
      } else {
        visit(callee, false, allowNestedFunctions);
      }

      for (const arg of args) {
        visit(arg, false, allowNestedFunctions);
      }

      return;
    }

    const entries = Object.entries(current);

    for (const [key, value] of entries) {
      if (key === 'type' || key === 'loc' || key === 'start' || key === 'end') {
        continue;
      }

      visit(value, isWriteContext, allowNestedFunctions);
    }
  };

  visit(node);

  return usages.sort((left, right) => left.location - right.location);
};
