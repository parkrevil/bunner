export const statementGroupingPlugin = {
  rules: {
    'blank-lines-between-statement-groups': {
      meta: {
        type: 'layout',
        fixable: 'whitespace',
        schema: [],
        messages: {
          expectedBlankLine: 'Expected a blank line between statement groups.',
          unexpectedBlankLine: 'Unexpected blank line within a statement group.',
        },
      },
      create(context: any) {
        const sourceCode = context.getSourceCode();
        const hasBlankLineBetweenStatements = (prev: any, next: any): boolean => {
          const prevEnd = prev?.range?.[1];
          const nextStart = next?.range?.[0];

          if (typeof prevEnd !== 'number' || typeof nextStart !== 'number') {
            return false;
          }

          const betweenText = sourceCode.text.slice(prevEnd, nextStart);
          const lines = betweenText.split(/\r?\n/);

          if (lines.length < 3) {
            return false;
          }

          const middleLines = lines.slice(1, -1);

          return middleLines.some((line: string) => line.trim() === '');
        };
        const removeBlankLinesBetweenStatements = (prev: any, next: any): string | null => {
          const prevEnd = prev?.range?.[1];
          const nextStart = next?.range?.[0];

          if (typeof prevEnd !== 'number' || typeof nextStart !== 'number') {
            return null;
          }

          const betweenText = sourceCode.text.slice(prevEnd, nextStart);
          const lines = betweenText.split(/\r?\n/);

          if (lines.length < 3) {
            return null;
          }

          const first = lines[0];
          const last = lines[lines.length - 1];
          const middle = lines.slice(1, -1).filter((line: string) => line.trim() !== '');

          return [first, ...middle, last].join('\n');
        };
        const unwrapExpression = (expr: any): any => {
          let current = expr;

          while (current) {
            if (current.type === 'AwaitExpression') {
              current = current.argument;
              continue;
            }

            if (current.type === 'ChainExpression') {
              current = current.expression;
              continue;
            }

            if (current.type === 'UnaryExpression' && current.operator === 'void') {
              current = current.argument;
              continue;
            }

            break;
          }

          return current;
        };
        const isIdentifierNamed = (node: any, name: string): boolean => {
          return node?.type === 'Identifier' && node.name === name;
        };
        const getMemberExpressionRootObject = (node: any): any => {
          let current = node;

          while (current && current.type === 'MemberExpression') {
            current = current.object;
          }

          return current;
        };
        const isThisMemberExpression = (node: any): boolean => {
          return getMemberExpressionRootObject(node)?.type === 'ThisExpression';
        };
        const isThisDotIdentifier = (node: any, name: string): boolean => {
          return (
            node?.type === 'MemberExpression' && node.object?.type === 'ThisExpression' && isIdentifierNamed(node.property, name)
          );
        };
        const isLoggingCallExpression = (expr: any): boolean => {
          const unwrapped = unwrapExpression(expr);

          if (unwrapped?.type !== 'CallExpression') {
            return false;
          }

          const called = unwrapped.callee;

          if (called?.type !== 'MemberExpression') {
            return false;
          }

          const obj = called.object;

          if (isIdentifierNamed(obj, 'console')) {
            return true;
          }

          if (isIdentifierNamed(obj, 'logger')) {
            return true;
          }

          if (isThisDotIdentifier(obj, 'logger')) {
            return true;
          }

          return false;
        };
        const isCallExpressionStatement = (node: any): boolean => {
          if (!node || node.type !== 'ExpressionStatement') {
            return false;
          }

          const expr = node.expression;

          if (!expr) {
            return false;
          }

          if (isLoggingCallExpression(expr)) {
            return false;
          }

          const unwrapped = unwrapExpression(expr);

          if (!unwrapped) {
            return false;
          }

          if (unwrapped.type === 'CallExpression') {
            return true;
          }

          if (unwrapped.type === 'NewExpression') {
            return true;
          }

          return false;
        };
        const isAssignmentExpressionStatement = (node: any): boolean => {
          if (!node || node.type !== 'ExpressionStatement') {
            return false;
          }

          const expr = node.expression;

          if (!expr) {
            return false;
          }

          return expr.type === 'AssignmentExpression' && expr.operator === '=';
        };
        const isThisAssignmentExpressionStatement = (node: any): boolean => {
          if (!node || node.type !== 'ExpressionStatement') {
            return false;
          }

          const expr = node.expression;

          if (!expr) {
            return false;
          }

          return expr.type === 'AssignmentExpression' && expr.operator === '=' && isThisMemberExpression(expr.left);
        };
        const isMutationExpressionStatement = (node: any): boolean => {
          if (!node || node.type !== 'ExpressionStatement') {
            return false;
          }

          const expr = node.expression;

          if (!expr) {
            return false;
          }

          if (expr.type === 'UpdateExpression') {
            return true;
          }

          if (expr.type === 'AssignmentExpression' && expr.operator !== '=') {
            return true;
          }

          return false;
        };
        const isThisMutationExpressionStatement = (node: any): boolean => {
          if (!node || node.type !== 'ExpressionStatement') {
            return false;
          }

          const expr = node.expression;

          if (!expr) {
            return false;
          }

          if (expr.type === 'UpdateExpression') {
            return isThisMemberExpression(expr.argument);
          }

          if (expr.type === 'AssignmentExpression' && expr.operator !== '=') {
            return isThisMemberExpression(expr.left);
          }

          return false;
        };
        const isDeleteExpressionStatement = (node: any): boolean => {
          if (!node || node.type !== 'ExpressionStatement') {
            return false;
          }

          const expr = node.expression;

          if (!expr) {
            return false;
          }

          return expr.type === 'UnaryExpression' && expr.operator === 'delete';
        };
        const isLoggingExpressionStatement = (node: any): boolean => {
          if (!node || node.type !== 'ExpressionStatement') {
            return false;
          }

          const expr = node.expression;

          if (!expr) {
            return false;
          }

          return isLoggingCallExpression(expr);
        };
        const getGroup = (node: any): string | null => {
          if (isLoggingExpressionStatement(node)) {
            return 'logging';
          }

          if (isDeleteExpressionStatement(node)) {
            return 'delete';
          }

          if (isThisMutationExpressionStatement(node)) {
            return 'mutation-this';
          }

          if (isMutationExpressionStatement(node)) {
            return 'mutation';
          }

          if (isThisAssignmentExpressionStatement(node)) {
            return 'assignment-this';
          }

          if (isAssignmentExpressionStatement(node)) {
            return 'assignment';
          }

          if (isCallExpressionStatement(node)) {
            return 'call';
          }

          return null;
        };
        const checkBody = (body: readonly any[]): void => {
          for (let index = 0; index < body.length - 1; index += 1) {
            const prev = body[index];
            const next = body[index + 1];

            if (!prev || !next) {
              continue;
            }

            const prevGroup = getGroup(prev);
            const nextGroup = getGroup(next);
            const mustSeparate =
              (prevGroup !== null && nextGroup !== null && prevGroup !== nextGroup) ||
              (prevGroup === 'logging' && nextGroup !== 'logging') ||
              (nextGroup === 'logging' && prevGroup !== 'logging');
            const sameGroup = prevGroup !== null && nextGroup !== null && prevGroup === nextGroup;
            const hasBlankLine = hasBlankLineBetweenStatements(prev, next);

            if (!mustSeparate) {
              if (!sameGroup) {
                continue;
              }

              if (!hasBlankLine) {
                continue;
              }

              const replacement = removeBlankLinesBetweenStatements(prev, next);

              if (replacement === null) {
                continue;
              }

              context.report({
                node: next,
                messageId: 'unexpectedBlankLine',
                fix(fixer: any) {
                  return fixer.replaceTextRange([prev.range[1], next.range[0]], replacement);
                },
              });

              continue;
            }

            if (hasBlankLine) {
              continue;
            }

            context.report({
              node: next,
              messageId: 'expectedBlankLine',
              fix(fixer: any) {
                return fixer.insertTextAfter(prev, '\n');
              },
            });
          }
        };

        return {
          Program(node: any) {
            checkBody(node.body);
          },
          BlockStatement(node: any) {
            checkBody(node.body);
          },
        };
      },
    },
    'blank-line-between-call-and-assignment': {
      meta: {
        type: 'layout',
        fixable: 'whitespace',
        schema: [],
        messages: {
          expectedBlankLine: 'Expected a blank line between call statements and assignment statements.',
        },
      },
      create(context: any) {
        return statementGroupingPlugin.rules['blank-lines-between-statement-groups'].create(context);
      },
    },
  },
};
