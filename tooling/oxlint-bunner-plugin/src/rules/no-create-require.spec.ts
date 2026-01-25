import { describe, expect, it } from 'bun:test';

import type { AstNode } from '../types';

import { createRuleContext, createSourceCode } from '../../test/utils/rule-test-kit';
import { noCreateRequireRule } from './no-create-require';

describe('no-create-require', () => {
  it('should report createRequire when imported from module', () => {
    // Arrange
    const sourceCode = createSourceCode('', null, null, []);
    const { context, reports } = createRuleContext(sourceCode, []);
    const visitor = noCreateRequireRule.create(context);
    const importNode: AstNode = {
      type: 'ImportDeclaration',
      source: { type: 'Literal', value: 'node:module' },
      specifiers: [
        {
          type: 'ImportSpecifier',
          imported: { type: 'Identifier', name: 'createRequire' },
          local: { type: 'Identifier', name: 'createRequire' },
        },
      ],
    };
    const callNode: AstNode = { type: 'CallExpression', callee: { type: 'Identifier', name: 'createRequire' } };

    // Act
    visitor.ImportDeclaration(importNode);
    visitor.CallExpression(callNode);

    // Assert
    expect(reports.length).toBe(1);
    expect(reports[0]?.messageId).toBe('createRequire');
  });

  it('should report createRequire when accessed via namespace import', () => {
    // Arrange
    const sourceCode = createSourceCode('', null, null, []);
    const { context, reports } = createRuleContext(sourceCode, []);
    const visitor = noCreateRequireRule.create(context);
    const importNode: AstNode = {
      type: 'ImportDeclaration',
      source: { type: 'Literal', value: 'module' },
      specifiers: [
        {
          type: 'ImportNamespaceSpecifier',
          local: { type: 'Identifier', name: 'moduleNamespace' },
        },
      ],
    };
    const callNode: AstNode = {
      type: 'CallExpression',
      callee: {
        type: 'MemberExpression',
        object: { type: 'Identifier', name: 'moduleNamespace' },
        property: { type: 'Identifier', name: 'createRequire' },
        computed: false,
      },
    };

    // Act
    visitor.ImportDeclaration(importNode);
    visitor.CallExpression(callNode);

    // Assert
    expect(reports.length).toBe(1);
    expect(reports[0]?.messageId).toBe('createRequire');
  });

  it('should ignore imports when module is not node:module', () => {
    // Arrange
    const sourceCode = createSourceCode('', null, null, []);
    const { context, reports } = createRuleContext(sourceCode, []);
    const visitor = noCreateRequireRule.create(context);
    const importNode: AstNode = {
      type: 'ImportDeclaration',
      source: { type: 'Literal', value: 'other-module' },
      specifiers: [
        {
          type: 'ImportSpecifier',
          imported: { type: 'Identifier', name: 'createRequire' },
          local: { type: 'Identifier', name: 'createRequire' },
        },
      ],
    };

    // Act
    visitor.ImportDeclaration(importNode);

    // Usage of createRequire from 'other-module' should not trigger report.
    const callNode: AstNode = { type: 'CallExpression', callee: { type: 'Identifier', name: 'createRequire' } };

    visitor.CallExpression(callNode);

    // Assert
    expect(reports.length).toBe(0);
  });
});
