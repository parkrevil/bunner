import type { AstNode, RuleContext } from '../types';

const noNonNullAssertionRule = {
  create(context: RuleContext) {
    return {
      TSNonNullExpression(node: AstNode) {
        context.report({
          messageId: 'nonNullAssertion',
          node,
        });
      },
    };
  },
  meta: {
    messages: {
      nonNullAssertion: 'Do not use non-null assertion (`!`). Make the type correct instead.',
    },
    schema: [],
    type: 'problem',
  },
};

export { noNonNullAssertionRule };
