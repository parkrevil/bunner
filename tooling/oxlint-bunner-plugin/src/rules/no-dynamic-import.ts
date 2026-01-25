import type { AstNode, RuleContext } from '../types';

const noDynamicImportRule = {
  create(context: RuleContext) {
    return {
      ImportExpression(node: AstNode) {
        const source = node.source;

        if (source?.type === 'Literal' && typeof source.value === 'string') {
          return;
        }

        context.report({
          messageId: 'dynamicImport',
          node,
        });
      },
    };
  },
  meta: {
    messages: {
      dynamicImport: 'Do not use dynamic import with non-literal specifier (e.g. import(someVar)).',
    },
    schema: [],
    type: 'problem',
  },
};

export { noDynamicImportRule };
