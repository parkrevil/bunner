import type { AstNode, RuleContext } from '../types';

const noAnyRule = {
  create(context: RuleContext) {
    return {
      TSAnyKeyword(node: AstNode) {
        context.report({
          messageId: 'any',
          node,
        });
      },
    };
  },
  meta: {
    messages: {
      any: 'Do not use `any`. Define a concrete type.',
    },
    schema: [],
    type: 'problem',
  },
};

export { noAnyRule };
