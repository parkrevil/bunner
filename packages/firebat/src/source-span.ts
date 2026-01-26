import * as ts from 'typescript';

import type { SourcePosition, SourceSpan } from './types';

const toPosition = (sourceFile: ts.SourceFile, offset: number): SourcePosition => {
  const position = sourceFile.getLineAndCharacterOfPosition(offset);

  return {
    line: position.line + 1,
    column: position.character + 1,
  };
};

export const toSpan = (sourceFile: ts.SourceFile, node: ts.Node): SourceSpan => {
  const start = toPosition(sourceFile, node.getStart(sourceFile));
  const end = toPosition(sourceFile, node.getEnd());

  return {
    start,
    end,
  };
};
