import type { SourcePosition } from '../types';

export interface LineIndex {
  toLineColumn(offset: number): SourcePosition;
}

export const createLineIndex = (sourceText: string): LineIndex => {
  const newlines: number[] = [];

  for (let index = 0; index < sourceText.length; index += 1) {
    if (sourceText[index] === '\n') {
      newlines.push(index);
    }
  }

  const toLineColumn = (offset: number): SourcePosition => {
    let left = 0;
    let right = newlines.length;

    while (left < right) {
      const mid = Math.floor((left + right) / 2);
      const value = newlines[mid];

      if (typeof value !== 'number') {
        break;
      }

      if (value < offset) {
        left = mid + 1;
      } else {
        right = mid;
      }
    }

    const line = left + 1;
    const lastNewline = left === 0 ? -1 : (newlines[left - 1] ?? -1);
    const column = offset - lastNewline - 1;

    return { line, column };
  };

  return { toLineColumn };
};
