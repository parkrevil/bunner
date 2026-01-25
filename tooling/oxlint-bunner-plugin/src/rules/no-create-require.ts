import type { AstNode, NodeOrNull, RuleContext } from '../types';

const noCreateRequireRule = {
  create(context: RuleContext) {
    const forbiddenSources = new Set(['node:module', 'module']);
    const createRequireIdentifiers = new Set<string>();
    const moduleNamespaceIdentifiers = new Set<string>();

    const isIdentifierNamed = (node: NodeOrNull, name: string): boolean => node?.type === 'Identifier' && node.name === name;

    return {
      ImportDeclaration(node: AstNode) {
        const sourceValue = node.source?.value;

        if (typeof sourceValue !== 'string' || !forbiddenSources.has(sourceValue)) {
          return;
        }

        const specifiers = Array.isArray(node.specifiers) ? node.specifiers : [];

        for (const spec of specifiers) {
          if (spec.type === 'ImportSpecifier' && isIdentifierNamed(spec.imported, 'createRequire')) {
            const local = spec.local;
            const localName = local?.type === 'Identifier' ? local.name : null;

            if (typeof localName === 'string' && localName.length > 0) {
              createRequireIdentifiers.add(localName);
            }
          }

          if (spec.type === 'ImportNamespaceSpecifier') {
            const local = spec.local;
            const localName = local?.type === 'Identifier' ? local.name : null;

            if (typeof localName === 'string' && localName.length > 0) {
              moduleNamespaceIdentifiers.add(localName);
            }
          }
        }
      },
      CallExpression(node: AstNode) {
        const callee = node.callee;
        const calleeName = callee?.type === 'Identifier' ? callee.name : null;

        if (typeof calleeName === 'string' && calleeName.length > 0 && createRequireIdentifiers.has(calleeName)) {
          context.report({ messageId: 'createRequire', node: callee ?? node });
        }

        if (callee?.type === 'MemberExpression' && callee.computed !== true) {
          const obj = callee.object;
          const objName = obj?.type === 'Identifier' ? obj.name : null;

          if (
            typeof objName === 'string' &&
            objName.length > 0 &&
            moduleNamespaceIdentifiers.has(objName) &&
            isIdentifierNamed(callee.property, 'createRequire')
          ) {
            context.report({ messageId: 'createRequire', node: callee });
          }
        }
      },
    };
  },
  meta: {
    messages: {
      createRequire: 'Do not use `createRequire`.',
    },
    schema: [],
    type: 'problem',
  },
};

export { noCreateRequireRule };
