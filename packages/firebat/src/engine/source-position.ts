import type { SourcePosition } from '../types';

export const getLineColumn = (sourceText: string, offset: number): SourcePosition => {
  let line = 1;
  let lastNewline = -1;

  for (let index = 0; index < offset; index += 1) {
    if (sourceText[index] === '\n') {
      line += 1;

      lastNewline = index;
    }
  }

  return { line, column: offset - lastNewline - 1 };
};
