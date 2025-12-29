import type { Glob } from 'bun';

import { compareCodePoint } from './codepoint-compare';

export async function scanGlobSorted(params: { readonly glob: Glob; readonly baseDir: string }): Promise<string[]> {
  const { glob, baseDir } = params;
  const results: string[] = [];

  for await (const file of glob.scan(baseDir)) {
    results.push(file);
  }

  results.sort(compareCodePoint);

  return results;
}
