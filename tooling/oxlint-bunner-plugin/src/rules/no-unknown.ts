import type { AstNode, RuleContext } from '../types';

const noUnknownRule = {
  create(context: RuleContext) {
    return {
      TSUnknownKeyword(node: AstNode) {
        context.report({
          messageId: 'unknown',
          node,
        });
      },
    };
  },
  meta: {
    messages: {
      unknown: 'Do not use `unknown`. Define a concrete type.',
    },
    schema: [],
    type: 'problem',
  },
};

export { noUnknownRule };
