import type { Statement, Expression, AssignmentExpression, UpdateExpression } from 'oxc-parser';

export interface VariableUsage {
  name: string;
  isWrite: boolean;
  isRead: boolean;
  location: number; // Node start offset
  writeKind?: 'declaration' | 'assignment' | 'compound-assignment' | 'logical-assignment' | 'update';
}

export interface VariableCollectorOptions {
  includeNestedFunctions?: boolean;
}

const isFunctionNode = (node: any): boolean => {
  if (!node || typeof node !== 'object') {
    return false;
  }

  return node.type === 'ArrowFunctionExpression';
};

const unwrapExpression = (node: any): any => {
  let current = node;

  while (current && typeof current === 'object') {
    if (current.type === 'ParenthesizedExpression') {
      current = current.expression;

      continue;
    }

    if (current.type === 'ChainExpression') {
      current = current.expression;

      continue;
    }

    break;
  }

  return current;
};

const evalStaticTruthiness = (node: any): boolean | null => {
  const n = unwrapExpression(node);

  if (!n || typeof n !== 'object') {
    return null;
  }

  if (n.type === 'Literal') {
    const value = n.value as unknown;

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

  if (n.type === 'UnaryExpression') {
    const operator = typeof n.operator === 'string' ? (n.operator as string) : '';
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

const getStaticObjectExpressionKeys = (node: any): Set<string> | null => {
  const n = unwrapExpression(node);

  if (!n || typeof n !== 'object' || n.type !== 'ObjectExpression') {
    return null;
  }

  const keys = new Set<string>();
  const properties = Array.isArray(n.properties) ? (n.properties as any[]) : [];

  for (const prop of properties) {
    if (!prop || typeof prop !== 'object') {
      continue;
    }

    if (prop.type !== 'Property') {
      continue;
    }

    const key = prop.key;

    if (key?.type === 'Identifier' && typeof key.name === 'string') {
      keys.add(key.name);

      continue;
    }

    if (key?.type === 'Literal' && typeof key.value === 'string') {
      keys.add(key.value);

      continue;
    }
  }

  return keys;
};

export const collectVariables = (node: Statement | Expression | any, options: VariableCollectorOptions = {}): VariableUsage[] => {
  const usages: VariableUsage[] = [];
  const includeNestedFunctions = options.includeNestedFunctions !== false;

  const visit = (
    n: any,
    isWriteContext: boolean = false,
    allowNestedFunctions: boolean = includeNestedFunctions,
    writeKind?: VariableUsage['writeKind'],
  ) => {
    if (!n || typeof n !== 'object') {
      return;
    }

    if (!allowNestedFunctions && isFunctionNode(n)) {
      return;
    }

    // Oxc Node Types
    // Observed in our environment: identifiers are represented as `Identifier`.
    if (n.type === 'Identifier' && typeof n.name === 'string') {
      const usage: VariableUsage = {
        name: n.name,
        isRead: !isWriteContext,
        isWrite: isWriteContext,
        location: typeof n.start === 'number' ? n.start : 0,
      };

      if (isWriteContext && writeKind) {
        usage.writeKind = writeKind;
      }

      usages.push(usage);

      return;
    }

    if (n.type === 'IdentifierReference') {
      // Usage (Reference)
      usages.push({
        name: n.name,
        isRead: !isWriteContext,
        isWrite: isWriteContext,
        location: n.start,
      });
    } else if (n.type === 'BindingIdentifier') {
      // Declaration
      usages.push({
        name: n.name,
        isRead: false,
        isWrite: true,
        location: n.start,
        writeKind: 'declaration',
      });
    } else if (n.type === 'AssignmentTargetIdentifier') {
      const usage: VariableUsage = {
        name: n.name,
        isRead: !isWriteContext,
        isWrite: isWriteContext,
        location: n.start,
      };

      if (isWriteContext && writeKind) {
        usage.writeKind = writeKind;
      }

      usages.push(usage);

      return;
    }

    {
      const type = typeof n.type === 'string' ? n.type : '';

      if (type.includes('MemberExpression')) {
        // `obj.prop` does not read `prop` as a variable; only `obj`.
        // `obj[prop]` reads both `obj` and `prop`.
        if (n.object) {
          visit(n.object, false, allowNestedFunctions);
        }

        if (n.computed && n.property) {
          visit(n.property, false, allowNestedFunctions);
        }

        if (n.expression) {
          visit(n.expression, false, allowNestedFunctions);
        }

        return;
      }
    }

    // Handle constructions
    if (n.type === 'LogicalExpression') {
      const operator = typeof n.operator === 'string' ? (n.operator as string) : '';
      const left = n.left;
      const right = n.right;

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

    if (n.type === 'ConditionalExpression') {
      const test = n.test;
      const consequent = n.consequent;
      const alternate = n.alternate;

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

    if (n.type === 'AssignmentExpression') {
      const assign = n as AssignmentExpression;
      const operator = typeof (assign as any).operator === 'string' ? ((assign as any).operator as string) : '=';

      if (operator === '=') {
        visit(assign.left, true, allowNestedFunctions, 'assignment'); // LHS is write
        visit(assign.right, false, allowNestedFunctions); // RHS is read

        return;
      }

      if (operator === '||=' || operator === '&&=' || operator === '??=') {
        visit(assign.left, false, allowNestedFunctions);
        visit(assign.left, true, allowNestedFunctions, 'logical-assignment');
        visit(assign.right, false, allowNestedFunctions);

        return;
      }

      // Compound assignment (+=, -=, ...)
      visit(assign.left, false, allowNestedFunctions); // reads LHS
      visit(assign.left, true, allowNestedFunctions, 'compound-assignment'); // writes LHS
      visit(assign.right, false, allowNestedFunctions); // RHS is read

      return;
    }

    if (n.type === 'UpdateExpression') {
      const update = n as UpdateExpression;

      // Treat update as both read and write.
      visit(update.argument as any, false, allowNestedFunctions);
      visit(update.argument as any, true, allowNestedFunctions, 'update');

      return;
    }

    if (n.type === 'VariableDeclarator') {
      const initKeys = getStaticObjectExpressionKeys(n.init);

      if (n.id?.type === 'ObjectPattern' && initKeys) {
        // Object destructuring defaults are only evaluated if the property is missing.
        const properties = Array.isArray(n.id.properties) ? (n.id.properties as any[]) : [];

        for (const prop of properties) {
          if (!prop || typeof prop !== 'object') {
            continue;
          }

          if (prop.type !== 'Property') {
            continue;
          }

          const keyNode = prop.key;
          const keyName =
            keyNode?.type === 'Identifier' && typeof keyNode.name === 'string'
              ? keyNode.name
              : keyNode?.type === 'Literal' && typeof keyNode.value === 'string'
                ? keyNode.value
                : null;
          const valueNode = prop.value;

          if (valueNode?.type === 'AssignmentPattern') {
            visit(valueNode.left, true, allowNestedFunctions, 'declaration');

            const shouldEvaluateDefault = keyName === null ? true : !initKeys.has(keyName);

            if (shouldEvaluateDefault) {
              visit(valueNode.right, false, allowNestedFunctions);
            }

            continue;
          }

          visit(valueNode, true, allowNestedFunctions, 'declaration');
        }
      } else {
        visit(n.id, true, allowNestedFunctions, 'declaration'); // Def
      }

      if (n.init) {
        visit(n.init, false, allowNestedFunctions);
      } // Use

      return;
    }

    if (n.type === 'CallExpression') {
      const callee = n.callee;
      const args = Array.isArray(n.arguments) ? (n.arguments as any[]) : [];
      const unwrappedCallee = unwrapExpression(callee);

      if (unwrappedCallee && isFunctionNode(unwrappedCallee)) {
        visit(unwrappedCallee, false, true);
      } else {
        visit(callee, false, allowNestedFunctions);
      }

      for (const arg of args) {
        visit(arg, false, allowNestedFunctions);
      }

      return;
    }

    if (Array.isArray(n)) {
      for (const c of n) {
        visit(c, isWriteContext, allowNestedFunctions);
      }

      return;
    }

    for (const key in n) {
      if (key === 'type' || key === 'loc' || key === 'start' || key === 'end') {
        continue;
      }

      visit(n[key], isWriteContext, allowNestedFunctions);
    }
  };

  visit(node);

  return usages.sort((left, right) => left.location - right.location);
};
