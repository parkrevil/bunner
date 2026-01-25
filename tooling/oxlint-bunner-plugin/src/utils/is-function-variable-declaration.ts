import type { AstNode } from '../types';

const isFunctionVariableDeclaration = (node: AstNode | null | undefined): boolean => {
  if (node?.type !== 'VariableDeclaration') {
    return false;
  }

  const declarations = Array.isArray(node.declarations) ? node.declarations : [];

  if (declarations.length === 0) {
    return false;
  }

  return declarations.every(declaration => {
    const init = declaration?.init;

    return init?.type === 'ArrowFunctionExpression' || init?.type === 'FunctionExpression';
  });
};

export { isFunctionVariableDeclaration };
