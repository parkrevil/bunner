import type { AstNode, NodeOrNull, RuleContext } from '../types';

const noDoubleAssertionRule = {
  create(context: RuleContext) {
    const unwrapExpression = (expr: NodeOrNull): NodeOrNull => {
      let current = expr;

      while (current) {
        if (current.type === 'TSParenthesizedExpression') {
          current = current.expression;

          continue;
        }

        if (current.type === 'ParenthesizedExpression') {
          current = current.expression;

          continue;
        }

        break;
      }

      return current;
    };

    const isAssertionExpression = (node: NodeOrNull): boolean =>
      node?.type === 'TSAsExpression' || node?.type === 'TSTypeAssertion';

    const getTypeAnnotationNode = (assertion: NodeOrNull): NodeOrNull => {
      if (!assertion) {
        return null;
      }

      if (assertion.type === 'TSAsExpression') {
        return assertion.typeAnnotation;
      }

      if (assertion.type === 'TSTypeAssertion') {
        return assertion.typeAnnotation;
      }

      return null;
    };

    const getInnerExpression = (assertion: NodeOrNull): NodeOrNull => {
      if (!assertion) {
        return null;
      }

      if (assertion.type === 'TSAsExpression') {
        return assertion.expression;
      }

      if (assertion.type === 'TSTypeAssertion') {
        return assertion.expression;
      }

      return null;
    };

    const isAnyOrUnknownKeyword = (typeNode: NodeOrNull): boolean =>
      typeNode?.type === 'TSAnyKeyword' || typeNode?.type === 'TSUnknownKeyword';

    const check = (node: AstNode): void => {
      const outer = node;
      const innerExpr = unwrapExpression(getInnerExpression(outer));

      if (!isAssertionExpression(innerExpr)) {
        return;
      }

      const innerType = getTypeAnnotationNode(innerExpr);

      if (!isAnyOrUnknownKeyword(innerType)) {
        return;
      }

      context.report({
        messageId: 'doubleAssertion',
        node: outer,
      });
    };

    return {
      TSAsExpression(node: AstNode) {
        check(node);
      },
      TSTypeAssertion(node: AstNode) {
        check(node);
      },
    };
  },
  meta: {
    messages: {
      doubleAssertion: 'Do not use double assertion (e.g. `x as unknown as T` / `x as any as T`).',
    },
    schema: [],
    type: 'problem',
  },
};

export { noDoubleAssertionRule };
