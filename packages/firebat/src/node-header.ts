import * as ts from 'typescript';

import type { FirebatItemKind, NodeHeader } from './types';

const resolveNameFromPropertyName = (name: ts.PropertyName, checker: ts.TypeChecker): string | null => {
  if (ts.isIdentifier(name) || ts.isPrivateIdentifier(name)) {
    return name.text;
  }

  if (ts.isStringLiteral(name) || ts.isNumericLiteral(name) || ts.isNoSubstitutionTemplateLiteral(name)) {
    return name.text;
  }

  if (ts.isComputedPropertyName(name)) {
    const symbol = checker.getSymbolAtLocation(name.expression);

    if (symbol) {
      const text = symbol.getName();

      if (text.length > 0) {
        return text;
      }
    }
  }

  return null;
};

const resolveNameFromDeclarationName = (
  name: ts.DeclarationName | undefined,
  checker: ts.TypeChecker,
): string | null => {
  if (!name) {
    return null;
  }

  if (ts.isIdentifier(name) || ts.isPrivateIdentifier(name)) {
    return name.text;
  }

  if (ts.isStringLiteral(name) || ts.isNumericLiteral(name) || ts.isNoSubstitutionTemplateLiteral(name)) {
    return name.text;
  }

  if (ts.isComputedPropertyName(name)) {
    const symbol = checker.getSymbolAtLocation(name.expression);

    if (symbol) {
      const text = symbol.getName();

      if (text.length > 0) {
        return text;
      }
    }
  }

  return null;
};

const resolveNodeName = (node: ts.Node, checker: ts.TypeChecker): string | null => {
  if (ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) {
    return resolveNameFromDeclarationName(node.name, checker);
  }

  if (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node)) {
    return resolveNameFromDeclarationName(node.name, checker);
  }

  if (ts.isMethodDeclaration(node) || ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node)) {
    if (node.name) {
      return resolveNameFromPropertyName(node.name, checker);
    }

    return null;
  }

  if (ts.isPropertyAssignment(node) && node.name) {
    return resolveNameFromPropertyName(node.name, checker);
  }

  if (ts.isVariableDeclaration(node) && node.name && ts.isIdentifier(node.name)) {
    return node.name.text;
  }

  return null;
};

const getItemKind = (node: ts.Node): FirebatItemKind => {
  if (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node)) {
    return 'function';
  }

  if (ts.isMethodDeclaration(node) || ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node)) {
    return 'method';
  }

  if (ts.isClassDeclaration(node) || ts.isClassExpression(node) || ts.isTypeAliasDeclaration(node)) {
    return 'type';
  }

  if (ts.isInterfaceDeclaration(node)) {
    return 'interface';
  }

  return 'node';
};

export const getNodeHeader = (node: ts.Node, checker: ts.TypeChecker): NodeHeader => {
  const resolved = resolveNodeName(node, checker);
  const header = resolved ?? 'anonymous';

  return {
    kind: getItemKind(node),
    header,
  };
};
