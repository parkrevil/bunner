import type { SourceToken } from '../../src/types';

const COMMA = ',';

const buildCommaTokens = (text: string): SourceToken[] => {
  const tokens: SourceToken[] = [];

  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === COMMA) {
      tokens.push({ value: COMMA, range: [i, i + 1] });
    }
  }

  return tokens;
};

export { buildCommaTokens };
