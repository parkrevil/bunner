import { describe, expect, it } from 'bun:test';

import type { AstNode } from '../types';

import { createRuleContext, createSourceCode } from '../../test/utils/rule-test-kit';
import { noDoubleAssertionRule } from './no-double-assertion';

describe('no-double-assertion', () => {
  it('should report double assertions when inner is any or unknown', () => {
    // Arrange
    const sourceCode = createSourceCode('', null, null, []);
    const { context, reports } = createRuleContext(sourceCode, []);
    const visitor = noDoubleAssertionRule.create(context);
    const innerNode: AstNode = { type: 'TSAsExpression', typeAnnotation: { type: 'TSUnknownKeyword' } };
    const outerNode: AstNode = { type: 'TSAsExpression', expression: innerNode, typeAnnotation: { type: 'TSTypeReference' } };

    // Act
    visitor.TSAsExpression(outerNode);

    // Assert
    expect(reports.length).toBe(1);
    expect(reports[0]?.messageId).toBe('doubleAssertion');
  });

  it('should skip report when inner assertion is not any or unknown', () => {
    // Arrange
    const sourceCode = createSourceCode('', null, null, []);
    const { context, reports } = createRuleContext(sourceCode, []);
    const visitor = noDoubleAssertionRule.create(context);
    const innerNode: AstNode = { type: 'TSAsExpression', typeAnnotation: { type: 'TSNumberKeyword' } };
    const outerNode: AstNode = { type: 'TSAsExpression', expression: innerNode, typeAnnotation: { type: 'TSTypeReference' } };

    // Act
    visitor.TSAsExpression(outerNode);

    // Assert
    expect(reports.length).toBe(0);
  });

  it('should report double assertions when using TSTypeAssertion syntax', () => {
    // Arrange
    // <T><any>x
    const sourceCode = createSourceCode('', null, null, []);
    const { context, reports } = createRuleContext(sourceCode, []);
    const visitor = noDoubleAssertionRule.create(context);
    const innerNode: AstNode = { type: 'TSTypeAssertion', typeAnnotation: { type: 'TSAnyKeyword' } };
    const outerNode: AstNode = { type: 'TSTypeAssertion', expression: innerNode, typeAnnotation: { type: 'TSTypeReference' } };

    // Act
    visitor.TSTypeAssertion(outerNode);

    // Assert
    expect(reports.length).toBe(1);
    expect(reports[0]?.messageId).toBe('doubleAssertion');
  });

  it('should report double assertion when wrapped in parentheses', () => {
    // Arrange
    // (x as any) as T
    const sourceCode = createSourceCode('', null, null, []);
    const { context, reports } = createRuleContext(sourceCode, []);
    const visitor = noDoubleAssertionRule.create(context);
    const innerNode: AstNode = { type: 'TSAsExpression', typeAnnotation: { type: 'TSAnyKeyword' } };
    const parenNode: AstNode = { type: 'ParenthesizedExpression', expression: innerNode };
    const outerNode: AstNode = { type: 'TSAsExpression', expression: parenNode, typeAnnotation: { type: 'TSTypeReference' } };

    // Act
    visitor.TSAsExpression(outerNode);

    // Assert
    expect(reports.length).toBe(1);
    expect(reports[0]?.messageId).toBe('doubleAssertion');
  });
});
