import * as path from 'node:path';

import type { ParsedFile } from '../../engine/types';
import type { SourceSpan, TypecheckAnalysis, TypecheckItem, TypecheckRunResult } from '../../types';

const normalizePath = (value: string): string => value.replaceAll('\\', '/');

const toAbsolutePath = (cwd: string, raw: string): string => {
  const normalized = normalizePath(raw);

  if (path.isAbsolute(normalized)) {
    return normalized;
  }

  return normalizePath(path.resolve(cwd, normalized));
};

const createEmptySpan = (): SourceSpan => ({
  start: {
    line: 1,
    column: 1,
  },
  end: {
    line: 1,
    column: 1,
  },
});

const createEmptyTypecheck = (): TypecheckAnalysis => ({
  status: 'ok',
  tool: 'tsc',
  exitCode: 0,
  items: [],
});

const buildLineIndex = (sourceText: string): ReadonlyArray<string> => {
  return sourceText.split(/\r?\n/);
};

const buildCodeFrame = (
  lines: ReadonlyArray<string>,
  line: number,
  column: number,
): Pick<TypecheckItem, 'lineText' | 'codeFrame'> => {
  const picked = lines[line - 1] ?? '';
  const safeColumn = Math.max(1, column);
  const caretPrefix = ' '.repeat(Math.max(0, safeColumn - 1));
  const caretLine = `${caretPrefix}^`;

  return {
    lineText: picked,
    codeFrame: picked.length > 0 ? `${picked}\n${caretLine}` : '',
  };
};

const parseTscDiagnostics = (cwd: string, combinedOutput: string): ReadonlyArray<Omit<TypecheckItem, 'lineText' | 'codeFrame'>> => {
  const items: Array<Omit<TypecheckItem, 'lineText' | 'codeFrame'>> = [];
  // Common tsc formats:
  // - path/to/file.ts(12,34): error TS2322: message
  // - path/to/file.ts:12:34 - error TS2322: message
  const parenPattern = /^(.*)\((\d+),(\d+)\):\s+(error|warning)\s+(TS\d+):\s+(.*)$/;
  const colonPattern = /^(.*):(\d+):(\d+)\s+-\s+(error|warning)\s+(TS\d+):\s+(.*)$/;
  let lastIndex = -1;

  for (const rawLine of combinedOutput.split(/\r?\n/)) {
    const line = rawLine.trimEnd();

    if (line.trim().length === 0) {
      continue;
    }

    const parenMatch = line.match(parenPattern);
    const colonMatch = parenMatch ? null : line.match(colonPattern);
    const match = parenMatch ?? colonMatch;

    if (!match) {
      // Some environments wrap long tsc messages across lines. If so, keep appending
      // to the previous diagnostic message to preserve information.
      if (lastIndex >= 0) {
        const previous = items[lastIndex];

        if (previous) {
          items[lastIndex] = {
            ...previous,
            message: `${previous.message} ${line.trim()}`.trim(),
          };
        }
      }

      continue;
    }

    const filePart = match[1] ?? '';
    const linePart = match[2] ?? '1';
    const columnPart = match[3] ?? '1';
    const severityPart = match[4] ?? 'error';
    const codePart = match[5] ?? 'TS0';
    const messagePart = match[6] ?? '';
    const filePath = filePart.length > 0 ? toAbsolutePath(cwd, filePart) : '';
    const lineNumber = Math.max(1, Number.parseInt(linePart, 10) || 1);
    const columnNumber = Math.max(1, Number.parseInt(columnPart, 10) || 1);
    const severity = severityPart === 'warning' ? 'warning' : 'error';
    const code = codePart;
    const message = messagePart.trim();

    items.push({
      severity,
      code,
      message,
      filePath,
      span: {
        start: {
          line: lineNumber,
          column: columnNumber,
        },
        end: {
          line: lineNumber,
          column: columnNumber,
        },
      },
    });

    lastIndex = items.length - 1;
  }

  return items;
};

const runTsc = async (cwd: string): Promise<TypecheckRunResult> => {
  try {
    const proc = Bun.spawn({
      cmd: ['bunx', 'tsc', '--pretty', 'false', '--noEmit'],
      cwd,
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const [stdout, stderr] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ]);
    const exitCode = await proc.exited;

    return {
      exitCode,
      combinedOutput: `${stdout}\n${stderr}`.trim(),
      status: 'ok',
    };
  } catch (err) {
    // Most commonly: tsgo binary not found (ENOENT)
    const message = err instanceof Error ? err.message : String(err);

    return {
      exitCode: null,
      combinedOutput: message,
      status: 'unavailable',
    };
  }
};

const attachCodeFrames = (
  program: ReadonlyArray<ParsedFile>,
  items: ReadonlyArray<Omit<TypecheckItem, 'lineText' | 'codeFrame'>>,
): ReadonlyArray<TypecheckItem> => {
  const sourceByPath = new Map<string, ReadonlyArray<string>>();

  for (const file of program) {
    sourceByPath.set(normalizePath(file.filePath), buildLineIndex(file.sourceText));
  }

  return items.map(item => {
    if (item.filePath.length === 0) {
      return {
        ...item,
        span: createEmptySpan(),
        lineText: '',
        codeFrame: '',
      };
    }

    const normalized = normalizePath(item.filePath);
    const lines = sourceByPath.get(normalized);

    if (!lines) {
      return {
        ...item,
        lineText: '',
        codeFrame: '',
      };
    }

    const frame = buildCodeFrame(lines, item.span.start.line, item.span.start.column);

    return {
      ...item,
      lineText: frame.lineText,
      codeFrame: frame.codeFrame,
    };
  });
};

const analyzeTypecheck = async (program: ReadonlyArray<ParsedFile>): Promise<TypecheckAnalysis> => {
  const cwd = process.cwd();
  const result = await runTsc(cwd);

  if (result.status !== 'ok') {
    return {
      status: result.status,
      tool: 'tsc',
      exitCode: result.exitCode,
      items: [],
    };
  }

  const parsed = parseTscDiagnostics(cwd, result.combinedOutput);
  const itemsWithFrames = attachCodeFrames(program, parsed);
  const items = [...itemsWithFrames].sort((left: TypecheckItem, right: TypecheckItem) => {
    if (left.filePath !== right.filePath) {
      return left.filePath.localeCompare(right.filePath);
    }

    if (left.span.start.line !== right.span.start.line) {
      return left.span.start.line - right.span.start.line;
    }

    return left.span.start.column - right.span.start.column;
  });

  return {
    status: 'ok',
    tool: 'tsc',
    exitCode: result.exitCode,
    items,
  };
};

export { analyzeTypecheck, createEmptyTypecheck, parseTscDiagnostics };
