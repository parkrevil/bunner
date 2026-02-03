/* oxlint-disable typescript-eslint/no-unsafe-assignment, typescript-eslint/no-unsafe-member-access, typescript-eslint/no-unsafe-argument, typescript-eslint/no-unsafe-call, typescript-eslint/no-unsafe-type-assertion, typescript-eslint/no-unsafe-return, firebat/no-any, typescript-eslint/strict-boolean-expressions */

import * as path from 'node:path';

import { getIndexStatsFromIndexUseCase, searchSymbolFromIndexUseCase } from '../symbol-index/symbol-index.usecases';

const resolveRootAbs = (root: string | undefined): string => {
  const cwd = process.cwd();

  if (root === undefined || root.trim().length === 0) {return cwd;}

  const trimmed = root.trim();

  return path.isAbsolute(trimmed) ? trimmed : path.resolve(cwd, trimmed);
};

interface GetSymbolsOverviewInput {
  readonly root?: string;
}

interface QuerySymbolsInput {
  readonly root?: string;
  readonly query: string;
  readonly kind?: string | ReadonlyArray<string>;
  readonly file?: string;
  readonly limit?: number;
}

export const getSymbolsOverviewUseCase = async (input: GetSymbolsOverviewInput) => {
  const rootAbs = resolveRootAbs(input.root);
  const stats = await getIndexStatsFromIndexUseCase({ root: rootAbs });

  return {
    root: rootAbs,
    index: stats,
  };
};

export const querySymbolsUseCase = async (input: QuerySymbolsInput) => {
  const rootAbs = resolveRootAbs(input.root);
  const matches = await searchSymbolFromIndexUseCase({
    root: rootAbs,
    query: input.query,
    ...(input.limit !== undefined ? { limit: input.limit } : {}),
  });
  const kindsRaw = input.kind === undefined ? [] : Array.isArray(input.kind) ? input.kind : [input.kind];
  const kinds = new Set(kindsRaw.map(k => k.toLowerCase()));
  const fileNeedle = (input.file ?? '').trim().toLowerCase();
  const filtered = matches.filter(m => {
    if (kinds.size > 0 && !kinds.has(m.kind.toLowerCase())) {return false;}

    if (fileNeedle && !m.filePath.toLowerCase().includes(fileNeedle)) {return false;}

    return true;
  });

  return { matches: filtered };
};

export type { GetSymbolsOverviewInput, QuerySymbolsInput };
