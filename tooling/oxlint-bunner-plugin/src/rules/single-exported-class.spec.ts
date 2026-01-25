import { describe, expect, it } from 'bun:test';

import type { AstNode } from '../types';

import { createRuleContext, createSourceCode } from '../../test/utils/rule-test-kit';
import { singleExportedClassRule } from './single-exported-class';

function createProgram(body: AstNode[]): AstNode {
  return { type: 'Program', body };
}

describe('single-exported-class', () => {
  it('should allow a single exported class when only one is exported', () => {
    // Arrange
    const sourceCode = createSourceCode('', null, null, []);
    const { context, reports } = createRuleContext(sourceCode, []);
    const visitor = singleExportedClassRule.create(context);
    const programNode = createProgram([
      {
        type: 'ExportNamedDeclaration',
        declaration: {
          type: 'ClassDeclaration',
          id: { type: 'Identifier', name: 'UserService' },
        },
      },
    ]);

    // Act
    visitor.Program(programNode);

    // Assert
    expect(reports.length).toBe(0);
  });

  it('should ignore files when no class is exported', () => {
    // Arrange
    const sourceCode = createSourceCode('', null, null, []);
    const { context, reports } = createRuleContext(sourceCode, []);
    const visitor = singleExportedClassRule.create(context);
    const programNode = createProgram([
      {
        type: 'ExportNamedDeclaration',
        declaration: {
          type: 'VariableDeclaration',
        },
      },
    ]);

    // Act
    visitor.Program(programNode);

    // Assert
    expect(reports.length).toBe(0);
  });

  it('should report when exporting a class and another export', () => {
    // Arrange
    const sourceCode = createSourceCode('', null, null, []);
    const { context, reports } = createRuleContext(sourceCode, []);
    const visitor = singleExportedClassRule.create(context);
    const programNode = createProgram([
      {
        type: 'ExportNamedDeclaration',
        declaration: {
          type: 'ClassDeclaration',
          id: { type: 'Identifier', name: 'UserService' },
        },
      },
      {
        type: 'ExportNamedDeclaration',
        declaration: {
          type: 'VariableDeclaration',
        },
      },
    ]);

    // Act
    visitor.Program(programNode);

    // Assert
    expect(reports.length).toBe(1);
    expect(reports[0]?.messageId).toBe('mixed');

    const reportedNode = reports[0]?.node;

    expect(reportedNode?.type).toBe('Program');
  });

  it('should report when exporting two classes', () => {
    // Arrange
    const sourceCode = createSourceCode('', null, null, []);
    const { context, reports } = createRuleContext(sourceCode, []);
    const visitor = singleExportedClassRule.create(context);
    const programNode = createProgram([
      {
        type: 'ExportNamedDeclaration',
        declaration: {
          type: 'ClassDeclaration',
          id: { type: 'Identifier', name: 'A' },
        },
      },
      {
        type: 'ExportNamedDeclaration',
        declaration: {
          type: 'ClassDeclaration',
          id: { type: 'Identifier', name: 'B' },
        },
      },
    ]);

    // Act
    visitor.Program(programNode);

    // Assert
    expect(reports.length).toBe(1);
    expect(reports[0]?.messageId).toBe('multiple');

    const reportedNode = reports[0]?.node;

    expect(reportedNode?.type).toBe('Program');
  });

  it('should allow class declaration when exported via specifier', () => {
    // Arrange
    const sourceCode = createSourceCode('', null, null, []);
    const { context, reports } = createRuleContext(sourceCode, []);
    const visitor = singleExportedClassRule.create(context);
    const programNode = createProgram([
      {
        type: 'ClassDeclaration',
        id: { type: 'Identifier', name: 'Foo' },
      },
      {
        type: 'ExportNamedDeclaration',
        specifiers: [
          {
            type: 'ExportSpecifier',
            local: { type: 'Identifier', name: 'Foo' },
            exported: { type: 'Identifier', name: 'Foo' },
          },
        ],
      },
    ]);

    // Act
    visitor.Program(programNode);

    // Assert
    expect(reports.length).toBe(0);
  });

  it('should report when exporting a class and an exported type', () => {
    // Arrange
    const sourceCode = createSourceCode('', null, null, []);
    const { context, reports } = createRuleContext(sourceCode, []);
    const visitor = singleExportedClassRule.create(context);
    const programNode = createProgram([
      {
        type: 'ExportNamedDeclaration',
        declaration: {
          type: 'ClassDeclaration',
          id: { type: 'Identifier', name: 'Foo' },
        },
      },
      {
        type: 'ExportNamedDeclaration',
        declaration: {
          type: 'TSTypeAliasDeclaration',
        },
      },
    ]);

    // Act
    visitor.Program(programNode);

    // Assert
    expect(reports.length).toBe(1);
    expect(reports[0]?.messageId).toBe('mixed');
  });

  it('should report when default-exporting a class and also exporting something else', () => {
    // Arrange
    const sourceCode = createSourceCode('', null, null, []);
    const { context, reports } = createRuleContext(sourceCode, []);
    const visitor = singleExportedClassRule.create(context);
    const programNode = createProgram([
      {
        type: 'ExportDefaultDeclaration',
        declaration: {
          type: 'ClassDeclaration',
          id: { type: 'Identifier', name: 'Foo' },
        },
      },
      {
        type: 'ExportNamedDeclaration',
        declaration: {
          type: 'VariableDeclaration',
        },
      },
    ]);

    // Act
    visitor.Program(programNode);

    // Assert
    expect(reports.length).toBe(1);
    expect(reports[0]?.messageId).toBe('mixed');
  });

  it('should report when exporting a class and also re-exporting everything', () => {
    // Arrange
    const sourceCode = createSourceCode('', null, null, []);
    const { context, reports } = createRuleContext(sourceCode, []);
    const visitor = singleExportedClassRule.create(context);
    const programNode = createProgram([
      {
        type: 'ExportNamedDeclaration',
        declaration: {
          type: 'ClassDeclaration',
          id: { type: 'Identifier', name: 'Foo' },
        },
      },
      {
        type: 'ExportAllDeclaration',
      },
    ]);

    // Act
    visitor.Program(programNode);

    // Assert
    expect(reports.length).toBe(1);
    expect(reports[0]?.messageId).toBe('mixed');
  });
});
