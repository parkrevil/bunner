import fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

type ParseSyncFn = (filePath: string, sourceText: string) => unknown;

const resolveOxcParserNativeBinding = (): string | null => {
  const candidates = [
    path.resolve(process.cwd(), 'node_modules/@oxc-parser/binding-linux-x64-gnu/parser.linux-x64-gnu.node'),
    path.resolve(process.cwd(), 'tooling/firebat/node_modules/@oxc-parser/binding-linux-x64-gnu/parser.linux-x64-gnu.node'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
};

const ensureOxcParserNativeBinding = (): void => {
  if (process.env.NAPI_RS_NATIVE_LIBRARY_PATH) {
    return;
  }

  const bindingPath = resolveOxcParserNativeBinding();

  if (bindingPath) {
    process.env.NAPI_RS_NATIVE_LIBRARY_PATH = bindingPath;
  }
};

ensureOxcParserNativeBinding();

const resolveOxcParserEntry = (): string | null => {
  const candidates = [
    path.resolve(process.cwd(), 'node_modules/oxc-parser/src-js/index.js'),
    path.resolve(process.cwd(), 'tooling/firebat/node_modules/oxc-parser/src-js/index.js'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
};

const loadParseSync = async (): Promise<ParseSyncFn> => {
  try {
    const mod = (await import('oxc-parser')) as unknown as { parseSync?: ParseSyncFn };

    if (typeof mod.parseSync === 'function') {
      return mod.parseSync;
    }
  } catch {
    // Ignore and try loading from disk.
  }

  const entry = resolveOxcParserEntry();

  if (!entry) {
    throw new Error('[firebat] Failed to resolve oxc-parser from disk. Run from the repo root or tooling/firebat.');
  }

  const url = pathToFileURL(entry).href;
  const mod = (await import(url)) as unknown as { parseSync?: ParseSyncFn };

  if (typeof mod.parseSync !== 'function') {
    throw new Error('[firebat] Loaded oxc-parser but parseSync is missing');
  }

  return mod.parseSync;
};

const parseSync: ParseSyncFn = await loadParseSync();

export interface ParseTask {
  filePath: string;
  sourceText: string;
}

export interface ParsedFile {
  filePath: string;
  program: unknown;
  errors: unknown[];
  comments: unknown[];
  sourceText: string;
}

export const parseSource = (filePath: string, sourceText: string): ParsedFile => {
  // Use oxc-parser's parseSync.
  // Note: Depending on the specific version/binding of oxc-parser, the API might vary slightly.
  // Assuming standard usage for now.
  const ret = parseSync(filePath, sourceText) as any;

  if (Array.isArray(ret.errors) && ret.errors.length > 0) {
    // We might want to handle errors or just pass them through
  }

  return {
    filePath,
    program: ret.program as unknown,
    errors: Array.isArray(ret.errors) ? (ret.errors as unknown[]) : [],
    comments: [],
    sourceText,
  };
};

export const getLineColumn = (source: string, offset: number): { line: number; column: number } => {
  let line = 1;
  let lastNewline = -1;

  for (let i = 0; i < offset; i++) {
    if (source[i] === '\n') {
      line++;

      lastNewline = i;
    }
  }

  return { line, column: offset - lastNewline - 1 };
};
