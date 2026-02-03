/* oxlint-disable typescript-eslint/no-deprecated, typescript-eslint/no-unsafe-type-assertion, typescript-eslint/no-unsafe-member-access, typescript-eslint/no-unsafe-call, typescript-eslint/no-explicit-any, firebat/no-any, firebat/no-unknown, firebat/no-inline-object-type, firebat/no-double-assertion, firebat/no-non-null-assertion */

import { ts } from '@ast-grep/napi';

import type { SourceSpan } from '../../types';

interface AstGrepMatch {
  readonly filePath: string;
  readonly span: SourceSpan;
  readonly text: string;
  readonly ruleId: string;
}

const toSpan = (range: {
  start: { line: number; column: number };
  end: { line: number; column: number };
}): SourceSpan => {
  return {
    start: { line: range.start.line + 1, column: range.start.column + 1 },
    end: { line: range.end.line + 1, column: range.end.column + 1 },
  };
};

const resolveMatcher = (input: {
  rule?: unknown;
  matcher?: unknown;
  ruleName?: string;
}): { ruleId: string; matcher: unknown } => {
  if (input.matcher !== undefined) {
    return { ruleId: input.ruleName ?? 'inline', matcher: input.matcher };
  }

  if (input.rule !== undefined) {
    return { ruleId: input.ruleName ?? 'inline', matcher: { rule: input.rule } };
  }

  throw new Error('Either matcher or rule must be provided.');
};

const findPatternInFiles = async (input: {
  targets: ReadonlyArray<string>;
  rule?: unknown;
  matcher?: unknown;
  ruleName?: string;
}): Promise<ReadonlyArray<AstGrepMatch>> => {
  const { ruleId, matcher } = resolveMatcher(input);
  const results: AstGrepMatch[] = [];

  for (const filePath of input.targets) {
    const code = await Bun.file(filePath).text();
    const sg = ts.parse(code);
    const root = sg.root() as unknown as {
      findAll?: (matcher: unknown) => ReadonlyArray<{ text: () => string; range: () => any }>;
      find?: (matcher: unknown) => { text: () => string; range: () => any } | null;
    };
    const nodes =
      typeof root.findAll === 'function'
        ? root.findAll(matcher)
        : typeof root.find === 'function'
          ? (root.find(matcher) ? [root.find(matcher)!] : [])
          : [];

    for (const node of nodes) {
      const range = node.range() as {
        start: { line: number; column: number };
        end: { line: number; column: number };
      };

      results.push({
        filePath,
        span: toSpan(range),
        text: node.text(),
        ruleId,
      });
    }
  }

  return results;
};

export { findPatternInFiles };
export type { AstGrepMatch };
