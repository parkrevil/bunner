import { describe, expect, it } from 'bun:test';

import { noNonNullAssertionRule } from './no-non-null-assertion';
import { createRuleContext, createSourceCode } from '../../test/utils/rule-test-kit';
import type { AstNode } from '../types';

describe('no-non-null-assertion', () => {
  it('should report non-null assertions when encountered', () => {
    // Arrange
    const sourceCode = createSourceCode('', null, null, []);
    const { context, reports } = createRuleContext(sourceCode, []);
    const visitor = noNonNullAssertionRule.create(context);
    const node: AstNode = { type: 'TSNonNullExpression' };

    // Act
    visitor.TSNonNullExpression(node);

    // Assert
    expect(reports.length).toBe(1);
    expect(reports[0]?.messageId).toBe('nonNullAssertion');
  });

  it('should report each assertion when multiple occurrences exist', () => {
    // Arrange
    const sourceCode = createSourceCode('', null, null, []);
    const { context, reports } = createRuleContext(sourceCode, []);
    const visitor = noNonNullAssertionRule.create(context);
    const firstNode: AstNode = { type: 'TSNonNullExpression' };
    const secondNode: AstNode = { type: 'TSNonNullExpression' };

    // Act
    visitor.TSNonNullExpression(firstNode);
    visitor.TSNonNullExpression(secondNode);

    // Assert
    expect(reports.length).toBe(2);
    expect(reports[0]?.messageId).toBe('nonNullAssertion');
    expect(reports[1]?.messageId).toBe('nonNullAssertion');
  });
});