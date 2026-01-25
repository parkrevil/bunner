import { describe, expect, it } from 'bun:test';

import type { AstNode } from '../types';

import { createRuleContext, createSourceCode } from '../../test/utils/rule-test-kit';
import { noUnknownRule } from './no-unknown';

describe('no-unknown', () => {
  it('should report unknown type when TSUnknownKeyword is encountered', () => {
    // Arrange
    const sourceCode = createSourceCode('', null, null, []);
    const { context, reports } = createRuleContext(sourceCode, []);
    const visitor = noUnknownRule.create(context);
    const node: AstNode = { type: 'TSUnknownKeyword' };

    // Act
    visitor.TSUnknownKeyword(node);

    // Assert
    expect(reports.length).toBe(1);
    expect(reports[0]?.messageId).toBe('unknown');
  });

  it('should report each unknown when multiple occurrences exist', () => {
    // Arrange
    const sourceCode = createSourceCode('', null, null, []);
    const { context, reports } = createRuleContext(sourceCode, []);
    const visitor = noUnknownRule.create(context);
    const firstNode: AstNode = { type: 'TSUnknownKeyword' };
    const secondNode: AstNode = { type: 'TSUnknownKeyword' };

    // Act
    visitor.TSUnknownKeyword(firstNode);
    visitor.TSUnknownKeyword(secondNode);

    // Assert
    expect(reports.length).toBe(2);
    expect(reports[0]?.messageId).toBe('unknown');
    expect(reports[1]?.messageId).toBe('unknown');
  });
});
