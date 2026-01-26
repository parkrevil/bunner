import type { RuleContext } from '../types.js';

const noTsIgnoreRule = {
  create(context: RuleContext) {
    const sourceCode = context.getSourceCode();

    const findTsIgnore = (): void => {
      const comments = sourceCode.getAllComments?.() ?? [];

      for (const comment of comments) {
        const raw = typeof comment.value === 'string' ? comment.value : '';

        if (!raw.includes('@ts-ignore')) {
          continue;
        }

        context.report({
          node: comment,
          messageId: 'tsIgnore',
        });
      }
    };

    return {
      Program() {
        findTsIgnore();
      },
    };
  },
  meta: {
    messages: {
      tsIgnore: 'Do not use `@ts-ignore`.',
    },
    schema: [],
    type: 'problem',
  },
};

export { noTsIgnoreRule };
