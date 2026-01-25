import { describe, expect, it } from 'bun:test';

import type { AstNode } from '../types';

import { createRuleContext, createSourceCode } from '../../test/utils/rule-test-kit';
import { testBddTitleRule } from './test-bdd-title';

describe('test-bdd-title', () => {
  it('should accept titles when they follow BDD format', () => {
    // Arrange
    const sourceCode = createSourceCode('', null, null, []);
    const { context, reports } = createRuleContext(sourceCode, []);
    const visitor = testBddTitleRule.create(context);
    const callNode: AstNode = {
      type: 'CallExpression',
      callee: { type: 'Identifier', name: 'it' },
      arguments: [{ type: 'Literal', value: 'should return 200 when payload is valid' }],
    };

    // Act
    visitor.CallExpression(callNode);

    // Assert
    expect(reports.length).toBe(0);
  });

  it('should accept titles when callee is it.only', () => {
    // Arrange
    const sourceCode = createSourceCode('', null, null, []);
    const { context, reports } = createRuleContext(sourceCode, []);
    const visitor = testBddTitleRule.create(context);
    const callNode: AstNode = {
      type: 'CallExpression',
      callee: {
        type: 'MemberExpression',
        object: { type: 'Identifier', name: 'it' },
        property: { type: 'Identifier', name: 'only' },
      },
      arguments: [{ type: 'Literal', value: 'should work when condition is met' }],
    };

    // Act
    visitor.CallExpression(callNode);

    // Assert
    expect(reports.length).toBe(0);
  });

  it('should report titles when they are non-BDD', () => {
    // Arrange
    const sourceCode = createSourceCode('', null, null, []);
    const { context, reports } = createRuleContext(sourceCode, []);
    const visitor = testBddTitleRule.create(context);
    const callNode: AstNode = {
      type: 'CallExpression',
      callee: { type: 'Identifier', name: 'test' },
      arguments: [{ type: 'Literal', value: 'works' }],
    };

    // Act
    visitor.CallExpression(callNode);

    // Assert
    expect(reports.length).toBe(1);
    expect(reports[0]?.messageId).toBe('bdd');

    const reportedNode = reports[0]?.node;

    expect(reportedNode?.type).toBe('CallExpression');
  });

  it('should report titles when when-clause is missing', () => {
    // Arrange
    const sourceCode = createSourceCode('', null, null, []);
    const { context, reports } = createRuleContext(sourceCode, []);
    const visitor = testBddTitleRule.create(context);
    const callNode: AstNode = {
      type: 'CallExpression',
      callee: { type: 'Identifier', name: 'it' },
      arguments: [{ type: 'Literal', value: 'should work' }],
    };

    // Act
    visitor.CallExpression(callNode);

    // Assert
    expect(reports.length).toBe(1);
    expect(reports[0]?.messageId).toBe('bdd');
  });

  it('should report titles when they do not start with lowercase should', () => {
    // Arrange
    const sourceCode = createSourceCode('', null, null, []);
    const { context, reports } = createRuleContext(sourceCode, []);
    const visitor = testBddTitleRule.create(context);
    const callNode: AstNode = {
      type: 'CallExpression',
      callee: { type: 'Identifier', name: 'test' },
      arguments: [{ type: 'Literal', value: 'Should work when condition is met' }],
    };

    // Act
    visitor.CallExpression(callNode);

    // Assert
    expect(reports.length).toBe(1);
    expect(reports[0]?.messageId).toBe('bdd');
  });

  it('should report titles when they are non-literal', () => {
    // Arrange
    const sourceCode = createSourceCode('', null, null, []);
    const { context, reports } = createRuleContext(sourceCode, []);
    const visitor = testBddTitleRule.create(context);
    const callNode: AstNode = {
      type: 'CallExpression',
      callee: { type: 'MemberExpression', object: { type: 'Identifier', name: 'it' } },
      arguments: [{ type: 'Identifier', name: 'title' }],
    };

    // Act
    visitor.CallExpression(callNode);

    // Assert
    expect(reports.length).toBe(1);
    expect(reports[0]?.messageId).toBe('bdd');
  });

  it('should ignore calls when callee is not a test function', () => {
    // Arrange
    const sourceCode = createSourceCode('', null, null, []);
    const { context, reports } = createRuleContext(sourceCode, []);
    const visitor = testBddTitleRule.create(context);
    const callNode: AstNode = {
      type: 'CallExpression',
      callee: { type: 'Identifier', name: 'describe' },
      arguments: [{ type: 'Literal', value: 'whatever' }],
    };

    // Act
    visitor.CallExpression(callNode);

    // Assert
    expect(reports.length).toBe(0);
  });
});
