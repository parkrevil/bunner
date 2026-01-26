import * as path from 'node:path';

import type { SourcePosition } from '../types';
import type { OxcParseResult, ParseSyncFn, ParsedFile } from './types';

import * as oxcParser from 'oxc-parser';

const resolveOxcParserNativeBinding = async (): Promise<string | null> => {
  const candidates = [
    path.resolve(process.cwd(), 'node_modules/@oxc-parser/binding-linux-x64-gnu/parser.linux-x64-gnu.node'),
    path.resolve(process.cwd(), 'tooling/firebat/node_modules/@oxc-parser/binding-linux-x64-gnu/parser.linux-x64-gnu.node'),
  ];

  for (const candidate of candidates) {
    if (await Bun.file(candidate).exists()) {
      return candidate;
    }
  }

  return null;
};

const ensureOxcParserNativeBinding = async (): Promise<void> => {
  if (Bun.env.NAPI_RS_NATIVE_LIBRARY_PATH) {
    return;
  }

  const bindingPath = await resolveOxcParserNativeBinding();

  if (bindingPath) {
    Bun.env.NAPI_RS_NATIVE_LIBRARY_PATH = bindingPath;
  }
};

await ensureOxcParserNativeBinding();

const loadParseSync = (): ParseSyncFn => {
  if (typeof oxcParser.parseSync === 'function') {
    return oxcParser.parseSync as unknown as ParseSyncFn;
  }

  throw new Error('[firebat] Loaded oxc-parser but parseSync is missing');
};

const parseSync: ParseSyncFn = loadParseSync();

export const parseSource = (filePath: string, sourceText: string): ParsedFile => {
  // Use oxc-parser's parseSync.
  // Note: Depending on the specific version/binding of oxc-parser, the API might vary slightly.
  // Assuming standard usage for now.
  const ret: OxcParseResult = parseSync(filePath, sourceText);

  if (Array.isArray(ret.errors) && ret.errors.length > 0) {
    // We might want to handle errors or just pass them through
  }

  return {
    filePath,
    program: ret.program,
    errors: Array.isArray(ret.errors) ? ret.errors : [],
    comments: [],
    sourceText,
  };
};

export const getLineColumn = (source: string, offset: number): SourcePosition => {
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
