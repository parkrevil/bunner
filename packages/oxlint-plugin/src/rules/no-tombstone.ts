import type { AstNode, RuleContext } from '../types';

function stripComments(text: string): string {
  // Remove block comments first, then line comments.
  const withoutBlockComments = text.replace(/\/\*[\s\S]*?\*\//g, '');

  return withoutBlockComments.replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function isOnlyEmptyExport(code: string): boolean {
  return /^export\s*\{\s*\}\s*;?\s*$/.test(code);
}

const noTombstoneRule = {
  create(context: RuleContext) {
    return {
      Program(node: AstNode) {
        const sourceCode = context.getSourceCode();
        const text = typeof sourceCode.getText === 'function' ? sourceCode.getText() : sourceCode.text;
        const stripped = stripComments(text).trim();

        if (stripped.length === 0 || isOnlyEmptyExport(stripped)) {
          context.report({
            messageId: 'tombstone',
            node,
          });
        }
      },
    };
  },
  meta: {
    messages: {
      tombstone:
        'Tombstone files are forbidden: remove the file or implement real code (no empty/comment-only/export{} placeholders).',
    },
    schema: [],
    type: 'problem',
  },
};

export { noTombstoneRule };
