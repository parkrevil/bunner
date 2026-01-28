import type { ParsedFile } from './engine/types';
import type { FirebatProgramConfig } from './interfaces';

import { parseSource } from './engine/parse-source';

const normalizePath = (filePath: string): string => filePath.replaceAll('\\', '/');

const shouldIncludeFile = (filePath: string): boolean => {
  const normalized = normalizePath(filePath);
  const segments = normalized.split('/');
  const nodeModulesSegment = 'node' + '_modules';

  if (segments.includes(nodeModulesSegment)) {
    return false;
  }

  if (normalized.endsWith('.d.ts')) {
    return false;
  }

  return true;
};

// Replaces createFirebatProgram to return ParsedFile[]
export const createFirebatProgram = async (config: FirebatProgramConfig): Promise<ParsedFile[]> => {
  const fileNames = config.targets;
  // Filter and parse
  const results: ParsedFile[] = [];

  for (const filePath of fileNames) {
    if (!shouldIncludeFile(filePath)) {
      continue;
    }

    const fileHandle: ReturnType<typeof Bun.file> = Bun.file(filePath);

    if (!(await fileHandle.exists())) {
      // Warning?
      continue;
    }

    try {
      const sourceText = await fileHandle.text();
      const parsed = parseSource(filePath, sourceText);

      results.push(parsed);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      console.error(`[firebat] Failed to parse ${filePath}: ${message}`);
    }
  }

  return results;
};

// End of file
