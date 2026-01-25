import { describe, expect, it } from 'bun:test';

import type { AstNode } from '../types';

import { createRuleContext, createSourceCode } from '../../test/utils/rule-test-kit';
import { noTombstoneRule } from './no-tombstone';

describe('no-tombstone', () => {
  it('should report when file is empty', () => {
    // Arrange
    const sourceCode = createSourceCode('', null, null, []);
    const { context, reports } = createRuleContext(sourceCode, []);
    const visitor = noTombstoneRule.create(context);
    const programNode: AstNode = { type: 'Program', body: [] };

    // Act
    visitor.Program(programNode);

    // Assert
    expect(reports.length).toBe(1);
    expect(reports[0]?.messageId).toBe('tombstone');

    const reportedNode = reports[0]?.node;

    expect(reportedNode?.type).toBe('Program');
  });

  it('should report when file is whitespace-only', () => {
    // Arrange
    const text = '   \n\n\t\n';
    const sourceCode = createSourceCode(text, null, null, []);
    const { context, reports } = createRuleContext(sourceCode, []);
    const visitor = noTombstoneRule.create(context);
    const programNode: AstNode = { type: 'Program', body: [] };

    // Act
    visitor.Program(programNode);

    // Assert
    expect(reports.length).toBe(1);
    expect(reports[0]?.messageId).toBe('tombstone');

    const reportedNode = reports[0]?.node;

    expect(reportedNode?.type).toBe('Program');
  });

  it('should report when file contains only comments', () => {
    // Arrange
    const text = '// just a comment\n/* and another */\n';
    const sourceCode = createSourceCode(text, null, null, []);
    const { context, reports } = createRuleContext(sourceCode, []);
    const visitor = noTombstoneRule.create(context);
    const programNode: AstNode = { type: 'Program', body: [] };

    // Act
    visitor.Program(programNode);

    // Assert
    expect(reports.length).toBe(1);
    expect(reports[0]?.messageId).toBe('tombstone');

    const reportedNode = reports[0]?.node;

    expect(reportedNode?.type).toBe('Program');
  });

  it('should report when comments use CRLF newlines', () => {
    // Arrange
    const text = '// just a comment\r\n/* and another */\r\n';
    const sourceCode = createSourceCode(text, null, null, []);
    const { context, reports } = createRuleContext(sourceCode, []);
    const visitor = noTombstoneRule.create(context);
    const programNode: AstNode = { type: 'Program', body: [] };

    // Act
    visitor.Program(programNode);

    // Assert
    expect(reports.length).toBe(1);
    expect(reports[0]?.messageId).toBe('tombstone');
  });

  it('should report when file only contains export {}', () => {
    // Arrange
    const text = 'export {};\n';
    const sourceCode = createSourceCode(text, null, null, []);
    const { context, reports } = createRuleContext(sourceCode, []);
    const visitor = noTombstoneRule.create(context);
    const programNode: AstNode = { type: 'Program', body: [] };

    // Act
    visitor.Program(programNode);

    // Assert
    expect(reports.length).toBe(1);
    expect(reports[0]?.messageId).toBe('tombstone');

    const reportedNode = reports[0]?.node;

    expect(reportedNode?.type).toBe('Program');
  });

  it('should report when export {} has comments or whitespace', () => {
    // Arrange
    const text = '  /* header */\nexport {}\n// footer\n';
    const sourceCode = createSourceCode(text, null, null, []);
    const { context, reports } = createRuleContext(sourceCode, []);
    const visitor = noTombstoneRule.create(context);
    const programNode: AstNode = { type: 'Program', body: [] };

    // Act
    visitor.Program(programNode);

    // Assert
    expect(reports.length).toBe(1);
    expect(reports[0]?.messageId).toBe('tombstone');
  });

  it('should skip report when file has content', () => {
    // Arrange
    const text = 'export const value = 1;\n';
    const sourceCode = createSourceCode(text, null, null, []);
    const { context, reports } = createRuleContext(sourceCode, []);
    const visitor = noTombstoneRule.create(context);
    const programNode: AstNode = { type: 'Program', body: [{ type: 'ExportNamedDeclaration' }] };

    // Act
    visitor.Program(programNode);

    // Assert
    expect(reports.length).toBe(0);
  });

  it('should skip report when export has bindings', () => {
    // Arrange
    const text = 'export { value };\n';
    const sourceCode = createSourceCode(text, null, null, []);
    const { context, reports } = createRuleContext(sourceCode, []);
    const visitor = noTombstoneRule.create(context);
    const programNode: AstNode = { type: 'Program', body: [{ type: 'ExportNamedDeclaration' }] };

    // Act
    visitor.Program(programNode);

    // Assert
    expect(reports.length).toBe(0);
  });

  it('should skip report when file contains URL string', () => {
    // Arrange
    const text = 'export const url = "http://example.com";\n';
    const sourceCode = createSourceCode(text, null, null, []);
    const { context, reports } = createRuleContext(sourceCode, []);
    const visitor = noTombstoneRule.create(context);
    const programNode: AstNode = { type: 'Program', body: [{ type: 'ExportNamedDeclaration' }] };

    // Act
    visitor.Program(programNode);

    // Assert
    expect(reports.length).toBe(0);
  });
});
