import { describe, expect, it } from 'bun:test';

import type { AstNode } from '../types';

import { createRuleContext, createSourceCode } from '../../test/utils/rule-test-kit';
import { testAaaCommentsRule } from './test-aaa-comments';

function makeTestCall(
  text: string,
  callee: 'it' | 'test' = 'it',
  callbackType: 'ArrowFunctionExpression' | 'FunctionExpression' = 'ArrowFunctionExpression',
) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}') + 1;
  const blockNode: AstNode = { type: 'BlockStatement', range: [start, end] };
  const callbackNode: AstNode = { type: callbackType, body: blockNode, range: [start, end] };
  const callNode: AstNode = {
    type: 'CallExpression',
    callee: { type: 'Identifier', name: callee },
    arguments: [{ type: 'Literal', value: 'should do x when y' }, callbackNode],
  };

  return { callNode, callbackNode };
}

describe('test-aaa-comments', () => {
  it('should accept AAA markers when order is correct', () => {
    // Arrange
    const text =
      "it('should do x when y', () => {\n  // Arrange\n  const value = 1;\n\n  // Act\n  const result = value + 1;\n\n  // Assert\n  expect(result).toBe(2);\n});\n";
    const { callNode } = makeTestCall(text);
    const sourceCode = createSourceCode(text, null, null, []);
    const { context, reports } = createRuleContext(sourceCode, []);
    const visitor = testAaaCommentsRule.create(context);

    // Act
    visitor.CallExpression(callNode);

    // Assert
    expect(reports.length).toBe(0);
  });

  it('should report only failing test when multi-test file is mixed', () => {
    // Arrange
    const text =
      "it('should do x when y', () => {\n  // Arrange\n  const value = 1;\n\n  // Act\n  const result = value + 1;\n\n  // Assert\n  expect(result).toBe(2);\n});\n\n" +
      "it('should do x when y', () => {\n  // Arrange\n  const value = 1;\n\n  // Assert\n  expect(value).toBe(1);\n});\n";
    const okStart = text.indexOf('() => {');
    const okBodyStart = text.indexOf('{', okStart);
    const okBodyEnd = text.indexOf('});', okBodyStart) + 1;
    const badStart = text.indexOf('() => {', okBodyEnd);
    const badBodyStart = text.indexOf('{', badStart);
    const badBodyEnd = text.lastIndexOf('});') + 1;
    const okCall: AstNode = {
      type: 'CallExpression',
      callee: { type: 'Identifier', name: 'it' },
      arguments: [
        { type: 'Literal', value: 'should do x when y' },
        { type: 'ArrowFunctionExpression', body: { type: 'BlockStatement', range: [okBodyStart, okBodyEnd] } },
      ],
    };
    const badCall: AstNode = {
      type: 'CallExpression',
      callee: { type: 'Identifier', name: 'it' },
      arguments: [
        { type: 'Literal', value: 'should do x when y' },
        { type: 'ArrowFunctionExpression', body: { type: 'BlockStatement', range: [badBodyStart, badBodyEnd] } },
      ],
    };
    const sourceCode = createSourceCode(text, null, null, []);
    const { context, reports } = createRuleContext(sourceCode, []);
    const visitor = testAaaCommentsRule.create(context);

    // Act
    visitor.CallExpression(okCall);
    visitor.CallExpression(badCall);

    // Assert
    expect(reports.length).toBe(1);
    expect(reports[0]?.messageId).toBe('missing');
  });

  it('should handle CRLF newlines when markers are present', () => {
    // Arrange
    const text =
      "it('should do x when y', () => {\r\n  // Arrange\r\n  const value = 1;\r\n\r\n  // Act\r\n  const result = value + 1;\r\n\r\n  // Assert\r\n  expect(result).toBe(2);\r\n});\r\n";
    const { callNode } = makeTestCall(text);
    const sourceCode = createSourceCode(text, null, null, []);
    const { context, reports } = createRuleContext(sourceCode, []);
    const visitor = testAaaCommentsRule.create(context);

    // Act
    visitor.CallExpression(callNode);

    // Assert
    expect(reports.length).toBe(0);
  });

  it('should report markers when missing space variant is used', () => {
    // Arrange
    const text =
      "it('should do x when y', () => {\n  //Arrange\n  const value = 1;\n\n  // Act\n  const result = value + 1;\n\n  // Assert\n  expect(result).toBe(2);\n});\n";
    const { callNode } = makeTestCall(text);
    const sourceCode = createSourceCode(text, null, null, []);
    const { context, reports } = createRuleContext(sourceCode, []);
    const visitor = testAaaCommentsRule.create(context);

    // Act
    visitor.CallExpression(callNode);

    // Assert
    expect(reports.length).toBe(1);
    expect(reports[0]?.messageId).toBe('missing');
  });

  it('should accept AAA markers when using test(...)', () => {
    // Arrange
    const text =
      "test('should do x when y', () => {\n  // Arrange\n  const value = 1;\n\n  // Act\n  const result = value + 1;\n\n  // Assert\n  expect(result).toBe(2);\n});\n";
    const { callNode } = makeTestCall(text, 'test');
    const sourceCode = createSourceCode(text, null, null, []);
    const { context, reports } = createRuleContext(sourceCode, []);
    const visitor = testAaaCommentsRule.create(context);

    // Act
    visitor.CallExpression(callNode);

    // Assert
    expect(reports.length).toBe(0);
  });

  it('should accept AAA markers when callback is FunctionExpression', () => {
    // Arrange
    const text =
      "it('should do x when y', function () {\n  // Arrange\n  const value = 1;\n\n  // Act\n  const result = value + 1;\n\n  // Assert\n  expect(result).toBe(2);\n});\n";
    const { callNode } = makeTestCall(text, 'it', 'FunctionExpression');
    const sourceCode = createSourceCode(text, null, null, []);
    const { context, reports } = createRuleContext(sourceCode, []);
    const visitor = testAaaCommentsRule.create(context);

    // Act
    visitor.CallExpression(callNode);

    // Assert
    expect(reports.length).toBe(0);
  });

  it('should report when any marker is missing', () => {
    // Arrange
    const text =
      "it('should do x when y', () => {\n  // Setup\n  const value = 1;\n\n  // Verify\n  expect(value).toBe(1);\n});\n";
    const { callNode } = makeTestCall(text);
    const sourceCode = createSourceCode(text, null, null, []);
    const { context, reports } = createRuleContext(sourceCode, []);
    const visitor = testAaaCommentsRule.create(context);

    // Act
    visitor.CallExpression(callNode);

    // Assert
    expect(reports.length).toBe(1);
    expect(reports[0]?.messageId).toBe('missing');
  });

  it('should report when callback is missing', () => {
    // Arrange
    const text = "it('should do x when y');\n";
    const sourceCode = createSourceCode(text, null, null, []);
    const { context, reports } = createRuleContext(sourceCode, []);
    const visitor = testAaaCommentsRule.create(context);
    const callNode: AstNode = {
      type: 'CallExpression',
      callee: { type: 'Identifier', name: 'it' },
      arguments: [{ type: 'Literal', value: 'should do x when y' }],
    };

    // Act
    visitor.CallExpression(callNode);

    // Assert
    expect(reports.length).toBe(1);
    expect(reports[0]?.messageId).toBe('missing');
  });

  it('should report when markers are out of order', () => {
    // Arrange
    const text =
      "it('should do x when y', () => {\n  // Act\n  const value = 1;\n\n  // Arrange\n  const result = value + 1;\n\n  // Assert\n  expect(result).toBe(2);\n});\n";
    const { callNode } = makeTestCall(text);
    const sourceCode = createSourceCode(text, null, null, []);
    const { context, reports } = createRuleContext(sourceCode, []);
    const visitor = testAaaCommentsRule.create(context);

    // Act
    visitor.CallExpression(callNode);

    // Assert
    expect(reports.length).toBe(1);
    expect(reports[0]?.messageId).toBe('order');
  });
});
