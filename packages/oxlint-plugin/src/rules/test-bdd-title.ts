import type { AstNode, RuleContext } from '../types';

function getIdentifierName(node: AstNode | null | undefined): string | null {
  if (!node) {
    return null;
  }

  if (node.type === 'Identifier' && typeof node.name === 'string') {
    return node.name;
  }

  return null;
}

function getCalleeName(callee: AstNode | null | undefined): string | null {
  const direct = getIdentifierName(callee);

  if (typeof direct === 'string' && direct.length > 0) {
    return direct;
  }

  if (callee?.type === 'MemberExpression') {
    const objectName = getIdentifierName(callee.object);

    if (typeof objectName === 'string' && objectName.length > 0) {
      return objectName;
    }
  }

  return null;
}

function getFirstArgString(node: AstNode): string | null {
  const args = node.arguments;

  if (!Array.isArray(args) || args.length === 0) {
    return null;
  }

  const first = args[0];

  if (!first || typeof first !== 'object' || Array.isArray(first)) {
    return null;
  }

  if (first.type === 'Literal' && typeof first.value === 'string') {
    return first.value;
  }

  return null;
}

const bddTitlePattern = /^should .+ when .+/;
const testBddTitleRule = {
  create(context: RuleContext) {
    return {
      CallExpression(node: AstNode) {
        const calleeName = getCalleeName(node.callee);

        if (calleeName !== 'it' && calleeName !== 'test') {
          return;
        }

        const title = getFirstArgString(node);

        if (typeof title !== 'string' || title.length === 0 || !bddTitlePattern.test(title)) {
          context.report({
            messageId: 'bdd',
            node,
          });
        }
      },
    };
  },
  meta: {
    messages: {
      bdd: 'Test title must match BDD pattern: "should ... when ...".',
    },
    schema: [],
    type: 'problem',
  },
};

export { testBddTitleRule };
