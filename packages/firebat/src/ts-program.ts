import * as path from 'node:path';
import * as ts from 'typescript';

import type { FirebatProgramConfig } from './interfaces';
import type { TsconfigLoadResult } from './types';

import { parseSource, type ParsedFile } from './engine/oxc-wrapper';

const normalizePath = (filePath: string): string => filePath.replaceAll('\\', '/');

// Keep config reading via TS for robustness
const readTsconfig = async (tsconfigPath: string): Promise<TsconfigLoadResult> => {
  let configText: string;

  try {
    configText = await Bun.file(tsconfigPath).text();
  } catch {
    throw new Error(`[firebat] Failed to read tsconfig: ${tsconfigPath}`);
  }

  const parsed = ts.parseConfigFileTextToJson(tsconfigPath, configText);

  if (parsed.error) {
    const message = ts.flattenDiagnosticMessageText(parsed.error.messageText, '\n');

    throw new Error(`[firebat] Failed to parse tsconfig: ${message}`);
  }

  const configDir = path.dirname(tsconfigPath);
  const config = ts.parseJsonConfigFileContent(parsed.config, ts.sys, configDir, undefined, tsconfigPath);

  if (config.errors.length > 0) {
    const message = config.errors
      .map(err => ts.flattenDiagnosticMessageText(err.messageText, '\n'))
      .filter(text => text.length > 0)
      .join('\n');

    throw new Error(`[firebat] Invalid tsconfig: ${message}`);
  }

  return {
    fileNames: config.fileNames,
    options: config.options,
    projectReferences: config.projectReferences,
  };
};

const shouldIncludeFile = (filePath: string): boolean => {
  const normalized = normalizePath(filePath);

  if (normalized.includes('/node_modules/')) {
    return false;
  }

  if (normalized.endsWith('.d.ts')) {
    return false;
  }

  return true;
};

// Replaces createFirebatProgram to return ParsedFile[]
export const createFirebatProgram = async (config: FirebatProgramConfig): Promise<ParsedFile[]> => {
  let fileNames: readonly string[];

  // 1. Resolve files
  if (config.targets?.length > 0) {
    // If targets provided, verify them
    // Simplified: just use them, maybe glob expand if needed but user usually passes paths or glob is expanded by shell.
    // If user passes directories, we might need to scan.
    // For now assume files.
    fileNames = config.targets;
  } else {
    // 2. Or load from tsconfig
    const loaded = await readTsconfig(config.tsconfigPath);

    fileNames = loaded.fileNames;
  }

  // 3. Filter and Parse
  const results: ParsedFile[] = [];

  for (const filePath of fileNames) {
    if (!shouldIncludeFile(filePath)) {
      continue;
    }

    if (!(await Bun.file(filePath).exists())) {
      // Warning?
      continue;
    }

    try {
      const sourceText = await Bun.file(filePath).text();
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
