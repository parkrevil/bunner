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

function getCallback(node: AstNode): AstNode | null {
  const args = node.arguments;

  if (!Array.isArray(args) || args.length < 2) {
    return null;
  }

  const candidate = args[1];

  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return null;
  }

  return candidate;
}

function getRange(node: AstNode): [number, number] | null {
  const range = node.range;

  if (!Array.isArray(range) || range.length !== 2) {
    return null;
  }

  const start = range[0];
  const end = range[1];

  if (typeof start !== 'number' || typeof end !== 'number') {
    return null;
  }

  return [start, end];
}

function getBlockText(context: RuleContext, callback: AstNode): string | null {
  const sourceCode = context.getSourceCode();
  const text = typeof sourceCode.getText === 'function' ? sourceCode.getText() : sourceCode.text;

  if (typeof text !== 'string' || text.length === 0) {
    return null;
  }

  const body = callback.body;

  if (body && typeof body === 'object' && !Array.isArray(body)) {
    const bodyRange = getRange(body);

    if (bodyRange) {
      return text.slice(bodyRange[0], bodyRange[1]);
    }
  }

  const callbackRange = getRange(callback);

  if (callbackRange) {
    return text.slice(callbackRange[0], callbackRange[1]);
  }

  return null;
}

function findMarkerPositions(blockText: string) {
  const arrange = blockText.indexOf('// Arrange');
  const act = blockText.indexOf('// Act');
  const assert = blockText.indexOf('// Assert');

  return { arrange, act, assert };
}

const testAaaCommentsRule = {
  create(context: RuleContext) {
    return {
      CallExpression(node: AstNode) {
        const calleeName = getCalleeName(node.callee);

        if (calleeName !== 'it' && calleeName !== 'test') {
          return;
        }

        const callback = getCallback(node);

        if (!callback) {
          context.report({
            messageId: 'missing',
            node,
          });

          return;
        }

        const blockText = getBlockText(context, callback);

        if (typeof blockText !== 'string' || blockText.length === 0) {
          context.report({
            messageId: 'missing',
            node,
          });

          return;
        }

        const { arrange, act, assert } = findMarkerPositions(blockText);

        if (arrange < 0 || act < 0 || assert < 0) {
          context.report({
            messageId: 'missing',
            node,
          });

          return;
        }

        if (!(arrange < act && act < assert)) {
          context.report({
            messageId: 'order',
            node,
          });
        }
      },
    };
  },
  meta: {
    messages: {
      missing: 'Test body must include mandatory AAA comments: // Arrange, // Act, // Assert.',
      order: 'AAA comments must appear in order: // Arrange → // Act → // Assert.',
    },
    schema: [],
    type: 'problem',
  },
};

export { testAaaCommentsRule };
