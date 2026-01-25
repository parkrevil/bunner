import { describe, expect, it } from 'bun:test';

import type { AstNode } from '../types';

import { createRuleContext, createSourceCode } from '../../test/utils/rule-test-kit';
import { noAnyRule } from './no-any';

describe('no-any', () => {
  it('should report any type when TSAnyKeyword is encountered', () => {
    // Arrange
    const sourceCode = createSourceCode('', null, null, []);
    const { context, reports } = createRuleContext(sourceCode, []);
    const visitor = noAnyRule.create(context);
    const node: AstNode = { type: 'TSAnyKeyword' };

    // Act
    visitor.TSAnyKeyword(node);

    // Assert
    expect(reports.length).toBe(1);
    expect(reports[0]?.messageId).toBe('any');
  });

  it('should report each any usage when multiple occurrences exist', () => {
    // Arrange
    const sourceCode = createSourceCode('', null, null, []);
    const { context, reports } = createRuleContext(sourceCode, []);
    const visitor = noAnyRule.create(context);
    const firstNode: AstNode = { type: 'TSAnyKeyword' };
    const secondNode: AstNode = { type: 'TSAnyKeyword' };

    // Act
    visitor.TSAnyKeyword(firstNode);
    visitor.TSAnyKeyword(secondNode);

    // Assert
    expect(reports.length).toBe(2);
    expect(reports[0]?.messageId).toBe('any');
    expect(reports[1]?.messageId).toBe('any');
  });
});
