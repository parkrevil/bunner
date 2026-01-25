import { describe, expect, it } from 'bun:test';

import type { CommentNode } from '../types';

import { createRuleContext, createSourceCode } from '../../test/utils/rule-test-kit';
import { noTsIgnoreRule } from './no-ts-ignore';

describe('no-ts-ignore', () => {
  it('should report when @ts-ignore appears in comments', () => {
    // Arrange
    const comments: CommentNode[] = [{ value: '@ts-ignore' }];
    const sourceCode = createSourceCode('', { comments }, null, []);
    const { context, reports } = createRuleContext(sourceCode, []);
    const visitor = noTsIgnoreRule.create(context);
    // const programNode: AstNode = { type: 'Program' }; // Removed unused

    // Act
    visitor.Program();

    // Assert
    expect(reports.length).toBe(1);
    expect(reports[0]?.messageId).toBe('tsIgnore');
  });

  it('should ignore comments when tag is absent', () => {
    // Arrange
    const comments: CommentNode[] = [{ value: 'no ignore here' }];
    const sourceCode = createSourceCode('', { comments }, null, []);
    const { context, reports } = createRuleContext(sourceCode, []);
    const visitor = noTsIgnoreRule.create(context);
    // const programNode: AstNode = { type: 'Program' };

    // Act
    visitor.Program();

    // Assert
    expect(reports.length).toBe(0);
  });
});
